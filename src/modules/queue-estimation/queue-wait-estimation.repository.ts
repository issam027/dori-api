import { ClockService } from '../../core/clock/clock.service';
import { QueueStatisticsRepository } from './queue-statistics.repository';
import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface WaitEstimationRegistration {
  registration_id: string;
  site_id: string;
  queue_id: string;
  business_date: string;
  average_wait_time: number;
}

export interface EstimationStatRow {
  activity_date: string;
  cycle_p50_minutes: number;
  sample_size: number;
  is_reliable: boolean;
  calculated_at: Date | string;
}

@Injectable()
export class QueueWaitEstimationRepository {
  private readonly refreshes = new Map<string, Promise<boolean>>();
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly statistics?: QueueStatisticsRepository,
    @Optional() private readonly clock?: ClockService,
  ) {}

  async findOperationalPosition(
    registrationId: string,
    now: Date,
  ): Promise<number | null> {
    const positions = await this.findOperationalPositions(
      [registrationId],
      now,
    );
    return positions.get(registrationId) ?? null;
  }

  async findOperationalPositions(
    registrationIds: string[],
    now: Date,
  ): Promise<Map<string, number>> {
    if (!registrationIds.length) return new Map();
    const rows = await this.dataSource.query<
      Array<{ registration_id: string; position: number }>
    >(
      'SELECT registration_id, position FROM dorify.queue_operational_positions(' +
        'ARRAY(SELECT DISTINCT queue_id FROM dorify.dori_registration WHERE registration_id=ANY($1::uuid[])), $2)' +
        ' WHERE registration_id=ANY($1::uuid[])',
      [registrationIds, now],
    );
    return new Map(
      rows.map((row) => [row.registration_id, Number(row.position)]),
    );
  }

  async countActiveThreads(queueId: string): Promise<number> {
    const rows: Array<{ count: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM dorify.dori_operator_session
       WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async findBestStat(
    siteId: string,
    queueId: string,
    activityDate: string,
  ): Promise<EstimationStatRow | null> {
    const now = this.clock?.now();
    const sql = `SELECT best.activity_date, best.cycle_p50_minutes, best.sample_size,
       best.is_reliable, best.calculated_at,
       (today.queue_id IS NULL OR rev.queue_id IS NULL OR rev.revision>today.input_revision
         OR today.calculated_at<COALESCE($4::timestamptz,CURRENT_TIMESTAMP)-INTERVAL '15 minutes') AS needs_refresh
       FROM dorify.dori_queue q
       LEFT JOIN dorify.dori_queue_estimation_revision rev ON rev.queue_id=q.queue_id
       LEFT JOIN dorify.dori_queue_estimation_stats today ON today.site_id=q.site_id
         AND today.queue_id=q.queue_id AND today.activity_date=$3::date
       LEFT JOIN LATERAL (
         SELECT activity_date,cycle_p50_minutes,sample_size,is_reliable,calculated_at
         FROM dorify.dori_queue_estimation_stats
         WHERE site_id=q.site_id AND queue_id=q.queue_id AND cycle_p50_minutes IS NOT NULL
         ORDER BY (activity_date=$3::date) DESC,calculated_at DESC LIMIT 1
       ) best ON TRUE
       WHERE q.site_id=$1 AND q.queue_id=$2`;
    const params = [siteId, queueId, activityDate, now ?? null];
    let rows = await this.dataSource.query<
      Array<EstimationStatRow & { needs_refresh?: boolean }>
    >(sql, params);
    if (rows[0]?.needs_refresh && this.statistics && now) {
      const key = queueId + ':' + activityDate;
      let work = this.refreshes.get(key);
      if (!work) {
        work = this.statistics.aggregateQueue({
          siteId,
          queueId,
          activityDate,
          now,
        });
        this.refreshes.set(key, work);
        void work
          .finally(() => this.refreshes.delete(key))
          .catch(() => undefined);
      }
      await work;
      rows = await this.dataSource.query(sql, params);
    }
    return rows[0]?.cycle_p50_minutes == null ? null : rows[0];
  }
}
