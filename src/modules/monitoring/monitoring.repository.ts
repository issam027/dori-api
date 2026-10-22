import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MonitoringRepository {
  constructor(private readonly dataSource: DataSource) {}

  async isDatabaseAvailable(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async activitySnapshot(): Promise<{
    notifications: Record<string, number>;
    openOperatorSessions: number;
    registrations: Record<string, number>;
  }> {
    const [notifications, sessions, registrations] = await Promise.all([
      this.dataSource.query(
        `SELECT notification_status AS status, COUNT(*)::int AS count
         FROM dori_notification
         WHERE notification_status IN ('pending', 'processing')
            OR (notification_status = 'failed' AND updated_at >= CURRENT_TIMESTAMP - interval '24 hours')
         GROUP BY notification_status`,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM dori_operator_session
         WHERE disconnected_at IS NULL`,
      ),
      this.dataSource.query(
        `SELECT status, COUNT(*)::int AS count FROM dori_registration
         WHERE is_active = TRUE AND status IN ('booked', 'waiting', 'in_progress')
         GROUP BY status`,
      ),
    ]);
    return {
      notifications: this.toStatusCounts(notifications),
      openOperatorSessions: sessions[0]?.count ?? 0,
      registrations: this.toStatusCounts(registrations),
    };
  }

  async liveSnapshot(siteId: number) {
    const [siteRows, queues, operators] = await Promise.all([
      this.dataSource.query(
        `SELECT site_id, timezone FROM dori_site
         WHERE site_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [siteId],
      ),
      this.dataSource.query(
        `SELECT q.queue_id, q.queue_name, q.average_wait_time AS estimated_wait_minutes,
          COUNT(r.registration_id) FILTER (WHERE r.status='waiting')::int AS waiting,
          COUNT(r.registration_id) FILTER (WHERE r.status='in_progress')::int AS in_progress,
          COUNT(DISTINCT os.session_id) FILTER (WHERE os.mode='active')::int AS open_desks,
          COUNT(DISTINCT os.user_id) FILTER (WHERE os.mode='active')::int AS active_operators,
          ROUND(MAX(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-r.priority_reference_time))/60)
            FILTER (WHERE r.status='waiting')::numeric, 2) AS longest_wait_minutes
         FROM dori_queue q
         LEFT JOIN dori_registration r ON r.queue_id=q.queue_id AND r.is_active=TRUE
           AND r.status IN ('waiting','in_progress')
         LEFT JOIN dori_operator_session os ON os.queue_id=q.queue_id
           AND os.disconnected_at IS NULL
         WHERE q.site_id=$1 AND q.is_active=TRUE AND q.deleted_at IS NULL
         GROUP BY q.queue_id,q.queue_name,q.average_wait_time ORDER BY q.queue_id`,
        [siteId],
      ),
      this.dataSource.query(
        `SELECT os.session_id,os.user_id,os.queue_id,os.counter_name,os.thread_number,
          os.connected_at,COALESCE(u.full_name,u.username) AS display_name,
          r.registration_id,r.ticket_number
         FROM dori_operator_session os
         JOIN dori_queue q ON q.queue_id=os.queue_id
         JOIN dori_user u ON u.user_id=os.user_id
         LEFT JOIN dori_registration r ON r.served_by_session_id=os.session_id
           AND r.status='in_progress' AND r.is_active=TRUE
         WHERE q.site_id=$1 AND os.disconnected_at IS NULL AND os.mode='active'
         ORDER BY os.user_id,os.session_id`,
        [siteId],
      ),
    ]);
    return { site: siteRows[0] ?? null, queues, operators };
  }

  private toStatusCounts(
    rows: Array<{ status: string; count: number }>,
  ): Record<string, number> {
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }
}
