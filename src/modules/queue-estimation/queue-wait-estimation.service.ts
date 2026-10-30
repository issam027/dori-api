import { Injectable } from '@nestjs/common';
import {
  QueueWaitEstimationRepository,
  WaitEstimationRegistration,
  EstimationStatRow,
} from './queue-wait-estimation.repository';

export interface WaitEstimate {
  estimatedWaitMinutes: number | null;
  position: number | null;
  method:
    'queue_daily_p50' | 'last_calculated' | 'theoretical_queue' | 'unavailable';
  sampleSize: number | null;
  calculatedAt: Date;
  statsCalculatedAt: Date | null;
  isReliable: boolean;
}

@Injectable()
export class QueueWaitEstimationService {
  constructor(private readonly repository: QueueWaitEstimationRepository) {}

  async estimate(
    registration: WaitEstimationRegistration,
    now: Date,
  ): Promise<WaitEstimate> {
    const [position, activeThreads, stat] = await Promise.all([
      this.repository.findOperationalPosition(
        registration.registration_id,
        now,
      ),
      this.repository.countActiveThreads(registration.queue_id),
      this.repository.findBestStat(
        registration.site_id,
        registration.queue_id,
        registration.business_date,
      ),
    ]);
    return this.buildEstimate(registration, now, position, activeThreads, stat);
  }

  async estimateMany(
    registrations: WaitEstimationRegistration[],
    now: Date,
  ): Promise<Map<string, WaitEstimate>> {
    if (!registrations.length) return new Map();
    const positions = await this.repository.findOperationalPositions(
      registrations.map((registration) => registration.registration_id),
      now,
    );
    const groups = new Map<string, WaitEstimationRegistration[]>();
    for (const registration of registrations) {
      const key = `${registration.queue_id}:${registration.business_date}`;
      const group = groups.get(key) ?? [];
      group.push(registration);
      groups.set(key, group);
    }
    const estimates = new Map<string, WaitEstimate>();
    for (const group of groups.values()) {
      const first = group[0];
      const [threads, stat] = await Promise.all([
        this.repository.countActiveThreads(first.queue_id),
        this.repository.findBestStat(
          first.site_id,
          first.queue_id,
          first.business_date,
        ),
      ]);
      for (const registration of group) {
        estimates.set(
          registration.registration_id,
          this.buildEstimate(
            registration,
            now,
            positions.get(registration.registration_id) ?? null,
            threads,
            stat,
          ),
        );
      }
    }
    return estimates;
  }

  private buildEstimate(
    registration: WaitEstimationRegistration,
    now: Date,
    position: number | null,
    activeThreads: number,
    stat: EstimationStatRow | null,
  ): WaitEstimate {
    if (position == null || activeThreads === 0) {
      return {
        estimatedWaitMinutes: null,
        position,
        method: 'unavailable',
        sampleSize: stat?.sample_size ?? null,
        calculatedAt: now,
        statsCalculatedAt: stat ? new Date(stat.calculated_at) : null,
        isReliable: false,
      };
    }

    const cycleMinutes = stat
      ? Number(stat.cycle_p50_minutes)
      : Number(registration.average_wait_time);
    const rawMinutes = ((position - 1) * cycleMinutes) / activeThreads;
    const estimatedWaitMinutes =
      rawMinutes <= 0 ? 0 : Math.max(1, Math.round(rawMinutes / 5) * 5);
    const isToday = stat?.activity_date === registration.business_date;
    return {
      estimatedWaitMinutes,
      position,
      method: stat
        ? isToday
          ? 'queue_daily_p50'
          : 'last_calculated'
        : 'theoretical_queue',
      sampleSize: stat?.sample_size ?? null,
      calculatedAt: now,
      statsCalculatedAt: stat ? new Date(stat.calculated_at) : null,
      isReliable: Boolean(isToday && stat?.is_reliable),
    };
  }

  async estimateQueue(input: {
    siteId: string;
    queueId: string;
    activityDate: string;
    waitingCount: number;
    activeThreads: number;
    theoreticalMinutes: number;
    now: Date;
  }): Promise<Omit<WaitEstimate, 'position'>> {
    const stat = await this.repository.findBestStat(
      input.siteId,
      input.queueId,
      input.activityDate,
    );
    if (input.activeThreads === 0) {
      return {
        estimatedWaitMinutes: null,
        method: 'unavailable',
        sampleSize: stat?.sample_size ?? null,
        calculatedAt: input.now,
        statsCalculatedAt: stat ? new Date(stat.calculated_at) : null,
        isReliable: false,
      };
    }
    const isToday = stat?.activity_date === input.activityDate;
    const cycleMinutes = stat
      ? Number(stat.cycle_p50_minutes)
      : input.theoreticalMinutes;
    const rawMinutes =
      (input.waitingCount * cycleMinutes) / input.activeThreads;
    return {
      estimatedWaitMinutes:
        rawMinutes <= 0 ? 0 : Math.max(1, Math.round(rawMinutes / 5) * 5),
      method: stat
        ? isToday
          ? 'queue_daily_p50'
          : 'last_calculated'
        : 'theoretical_queue',
      sampleSize: stat?.sample_size ?? null,
      calculatedAt: input.now,
      statsCalculatedAt: stat ? new Date(stat.calculated_at) : null,
      isReliable: Boolean(isToday && stat?.is_reliable),
    };
  }
}
