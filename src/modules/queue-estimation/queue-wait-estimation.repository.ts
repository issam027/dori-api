import { Injectable } from '@nestjs/common';
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
  constructor(private readonly dataSource: DataSource) {}

  async findOperationalPosition(
    registrationId: string,
    now: Date,
  ): Promise<number | null> {
    const rows: Array<{ position: number }> = await this.dataSource.query(
      `WITH context AS (
         SELECT target.queue_id, target.business_date
         FROM dorify.dori_registration target WHERE target.registration_id = $1
       ), ranked AS (
         SELECT r.registration_id,
           ROW_NUMBER() OVER (ORDER BY
             CASE WHEN r.entry_type = 'walkin'
                    OR (r.appointment_status = 'checked_in' AND r.scheduled_time <= $2)
               THEN 0 ELSE 1 END ASC,
             CASE WHEN r.entry_type = 'appointment'
               THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                 + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                   * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
               ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                 + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                   * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
             END DESC,
             r.scheduled_time ASC NULLS FIRST,
             r.registration_id ASC
           )::int AS position
         FROM dorify.dori_registration r
         JOIN context c ON c.queue_id = r.queue_id AND c.business_date = r.business_date
         JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
         JOIN dorify.dori_site s ON s.site_id = q.site_id
         WHERE r.status = 'waiting' AND r.is_active = TRUE
           AND (r.entry_type = 'walkin' OR r.appointment_status = 'checked_in')
       ) SELECT position FROM ranked WHERE registration_id = $1`,
      [registrationId, now],
    );
    return rows[0]?.position == null ? null : Number(rows[0].position);
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
    const rows: EstimationStatRow[] = await this.dataSource.query(
      `SELECT activity_date, cycle_p50_minutes, sample_size, is_reliable, calculated_at
       FROM dorify.dori_queue_estimation_stats
       WHERE site_id = $1 AND queue_id = $2 AND cycle_p50_minutes IS NOT NULL
       ORDER BY (activity_date = $3::date) DESC, calculated_at DESC
       LIMIT 1`,
      [siteId, queueId, activityDate],
    );
    return rows[0] ?? null;
  }
}
