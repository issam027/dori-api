import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface EstimationQueueRow {
  site_id: string;
  queue_id: string;
  timezone: string;
}

@Injectable()
export class QueueEstimationWorkerRepository {
  constructor(private readonly dataSource: DataSource) {}

  findActiveQueues(): Promise<EstimationQueueRow[]> {
    return this.dataSource.query(
      `SELECT q.site_id, q.queue_id, s.timezone
       FROM dorify.dori_queue q JOIN dorify.dori_site s ON s.site_id = q.site_id
       WHERE q.is_active = TRUE AND s.is_active = TRUE
       ORDER BY q.site_id, q.queue_id`,
    );
  }

  aggregateQueue(input: {
    siteId: string;
    queueId: string;
    activityDate: string;
    now: Date;
  }): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const lock = returningRows<{ acquired: boolean }>(
        await manager.query(
          "SELECT pg_try_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, 0)) AS acquired",
          ['queue-estimation', input.queueId],
        ),
      );
      if (!lock[0]?.acquired) return false;

      await manager.query(
        `WITH ordered_calls AS (
           SELECT r.called_at,
             LEAD(r.called_at) OVER (
               PARTITION BY r.served_by_session_id, r.business_date
               ORDER BY r.called_at, r.registration_id
             ) AS next_called_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = $2 AND r.business_date = $3::date
             AND r.called_at IS NOT NULL AND r.served_by_session_id IS NOT NULL
             AND r.is_active = TRUE
         ), cycles AS (
           SELECT EXTRACT(EPOCH FROM (next_called_at - called_at)) / 60.0 AS minutes
           FROM ordered_calls
           WHERE next_called_at IS NOT NULL AND next_called_at >= called_at
             AND next_called_at - called_at <= INTERVAL '8 hours'
         ), waits AS (
           SELECT EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)) / 60.0 AS minutes
           FROM dorify.dori_registration r
           WHERE r.queue_id = $2 AND r.business_date = $3::date
             AND r.called_at IS NOT NULL AND r.checked_in_at IS NOT NULL
             AND r.called_at >= r.checked_in_at AND r.is_active = TRUE
         ), cycle_stats AS (
           SELECT COUNT(*)::int AS sample_size,
             ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY minutes))::int AS p50,
             ROUND(PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY minutes))::int AS p65,
             ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY minutes))::int AS p90
           FROM cycles
         ), wait_stats AS (
           SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY minutes))::int AS p50,
             ROUND(PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY minutes))::int AS p65,
             ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY minutes))::int AS p90
           FROM waits
         ), bounds AS (
           SELECT COALESCE(MIN(COALESCE(r.checked_in_at, r.called_at)), $4) AS started_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = $2 AND r.business_date = $3::date AND r.is_active = TRUE
         )
         INSERT INTO dorify.dori_queue_estimation_stats (
           site_id, queue_id, activity_date, window_started_at, window_ended_at,
           cycle_p50_minutes, cycle_p65_minutes, cycle_p90_minutes,
           wait_p50_minutes, wait_p65_minutes, wait_p90_minutes,
           sample_size, is_reliable, calculated_at, created_at, updated_at
         )
         SELECT $1, $2, $3::date, b.started_at, $4,
           c.p50, c.p65, c.p90, w.p50, w.p65, w.p90,
           c.sample_size, c.sample_size >= 30, $4, $4, $4
         FROM cycle_stats c CROSS JOIN wait_stats w CROSS JOIN bounds b
         ON CONFLICT (site_id, queue_id, activity_date) DO UPDATE SET
           window_started_at = EXCLUDED.window_started_at,
           window_ended_at = EXCLUDED.window_ended_at,
           cycle_p50_minutes = EXCLUDED.cycle_p50_minutes,
           cycle_p65_minutes = EXCLUDED.cycle_p65_minutes,
           cycle_p90_minutes = EXCLUDED.cycle_p90_minutes,
           wait_p50_minutes = EXCLUDED.wait_p50_minutes,
           wait_p65_minutes = EXCLUDED.wait_p65_minutes,
           wait_p90_minutes = EXCLUDED.wait_p90_minutes,
           sample_size = EXCLUDED.sample_size,
           is_reliable = EXCLUDED.is_reliable,
           calculated_at = EXCLUDED.calculated_at,
           updated_at = EXCLUDED.updated_at`,
        [input.siteId, input.queueId, input.activityDate, input.now],
      );
      return true;
    });
  }
}
