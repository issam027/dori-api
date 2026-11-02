import { Injectable } from '@nestjs/common';
import {
  QueueWaitEstimationRepository,
  WaitEstimationRegistration,
  OperationalEstimateRow,
  EstimationMethod,
} from './queue-wait-estimation.repository';

export interface WaitEstimate {
  estimatedWaitMinutes: number | null;
  position: number | null;
  method: EstimationMethod;
  sampleSize: number | null;
  calculatedAt: Date;
  statsCalculatedAt: Date | null;
  isReliable: boolean;
}

/** API facade: calculations and freshness rules live in the shared database engine. */
@Injectable()
export class QueueWaitEstimationService {
  constructor(private readonly repository: QueueWaitEstimationRepository) {}

  private map(
    row: OperationalEstimateRow | undefined,
    now: Date,
  ): WaitEstimate {
    return {
      position: row?.position == null ? null : Number(row.position),
      estimatedWaitMinutes:
        row?.estimated_wait_minutes == null
          ? null
          : Number(row.estimated_wait_minutes),
      method: row?.method ?? 'unavailable',
      sampleSize: row?.sample_size == null ? null : Number(row.sample_size),
      calculatedAt: row ? new Date(row.calculated_at) : now,
      statsCalculatedAt: row?.stats_calculated_at
        ? new Date(row.stats_calculated_at)
        : null,
      isReliable: row?.is_reliable ?? false,
    };
  }

  async estimate(
    registration: WaitEstimationRegistration,
    now: Date,
  ): Promise<WaitEstimate> {
    return (await this.estimateMany([registration], now)).get(
      registration.registration_id,
    )!;
  }

  async estimateMany(
    registrations: WaitEstimationRegistration[],
    now: Date,
  ): Promise<Map<string, WaitEstimate>> {
    const rows = await this.repository.findTicketEstimates(
      registrations.map((registration) => registration.registration_id),
      now,
    );
    const byId = new Map(rows.map((row) => [row.registration_id, row]));
    return new Map(
      registrations.map((registration) => [
        registration.registration_id,
        this.map(byId.get(registration.registration_id), now),
      ]),
    );
  }

  async estimateQueue(input: {
    queueId: string;
    activityDate: string;
    now: Date;
  }): Promise<
    Omit<WaitEstimate, 'position'> & {
      waitingCount: number;
      activeThreads: number;
    }
  > {
    const row = await this.repository.findQueueContext(
      input.queueId,
      input.now,
      input.activityDate,
    );
    const { position: _position, ...estimate } = this.map(
      row ?? undefined,
      input.now,
    );
    return {
      ...estimate,
      waitingCount: Number(row?.waiting_count ?? 0),
      activeThreads: Number(row?.active_threads ?? 0),
    };
  }
}
