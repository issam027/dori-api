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
         FROM dori_notification GROUP BY notification_status`,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM dori_operator_session
         WHERE disconnected_at IS NULL`,
      ),
      this.dataSource.query(
        `SELECT status, COUNT(*)::int AS count FROM dori_registration
         WHERE is_active = TRUE GROUP BY status`,
      ),
    ]);
    return {
      notifications: this.toStatusCounts(notifications),
      openOperatorSessions: sessions[0]?.count ?? 0,
      registrations: this.toStatusCounts(registrations),
    };
  }

  private toStatusCounts(
    rows: Array<{ status: string; count: number }>,
  ): Record<string, number> {
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }
}
