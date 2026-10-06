import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ReportScope {
  siteId?: number;
  siteIds?: number[];
  queueIds?: number[];
}

export interface QueueIdentityRow {
  queue_name: string;
  queue_code: string;
  site_name: string;
}

export interface DailyStatsRow {
  total_registered: number;
  total_walkin: number;
  total_appointment: number;
  total_served: number;
  total_no_show: number;
  total_expired: number;
  total_cancelled: number;
  avg_wait_minutes: string | null;
  avg_service_minutes: string | null;
}

export interface DashboardSummaryRow {
  active_sites: number;
  active_queues: number;
  waiting_total: number;
  waiting_walkin: number;
  waiting_appointment: number;
  appointments_today: number;
}

export interface QueueLoadRow {
  queue_id: number;
  queue_code: string;
  queue_name: string;
  site_id: number;
  site_name: string;
  queue_type: 'walkin' | 'hybrid';
  waiting_count: number;
  dominant_tier: string;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findQueueIdentity(queueId: number): Promise<QueueIdentityRow | null> {
    const rows = await this.dataSource.query<QueueIdentityRow[]>(
      `SELECT q.queue_name, q.queue_code, s.site_name
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  async getDailyStats(queueId: number, date: string): Promise<DailyStatsRow> {
    const rows = await this.dataSource.query<DailyStatsRow[]>(
      `SELECT COUNT(*)::int AS total_registered,
       COUNT(*) FILTER (WHERE entry_type = 'walkin')::int AS total_walkin,
       COUNT(*) FILTER (WHERE entry_type = 'appointment')::int AS total_appointment,
       COUNT(*) FILTER (WHERE status = 'served')::int AS total_served,
       COUNT(*) FILTER (WHERE status = 'no_show')::int AS total_no_show,
       COUNT(*) FILTER (WHERE status = 'expired')::int AS total_expired,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS total_cancelled,
       ROUND(AVG(EXTRACT(EPOCH FROM (called_at - priority_reference_time))/60)
         FILTER (WHERE status = 'served' AND called_at IS NOT NULL)::numeric, 1) AS avg_wait_minutes,
       ROUND(AVG(EXTRACT(EPOCH FROM (served_at - called_at))/60)
         FILTER (WHERE status = 'served' AND served_at IS NOT NULL AND called_at IS NOT NULL)::numeric, 1) AS avg_service_minutes
       FROM dori_customer WHERE queue_id = $1 AND business_date = $2`,
      [queueId, date],
    );
    return rows[0];
  }

  async getDashboardSummary(scope: ReportScope): Promise<DashboardSummaryRow> {
    const { siteFilter, queueFilter, params } = this.buildScope(scope);
    const rows = await this.dataSource.query<DashboardSummaryRow[]>(
      `SELECT COUNT(DISTINCT s.site_id)::int AS active_sites,
       COUNT(DISTINCT q.queue_id)::int AS active_queues,
       COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active)::int AS waiting_total,
       COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active AND c.entry_type = 'walkin')::int AS waiting_walkin,
       COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active AND c.entry_type = 'appointment')::int AS waiting_appointment,
       COUNT(c.customer_id) FILTER (WHERE c.entry_type = 'appointment' AND c.is_active AND c.business_date = CURRENT_DATE)::int AS appointments_today
       FROM dori_site s
       LEFT JOIN dori_site_queue_thread q ON q.site_id = s.site_id AND ${queueFilter}
       LEFT JOIN dori_customer c ON c.queue_id = q.queue_id AND c.is_active
       WHERE ${siteFilter}`,
      params,
    );
    return rows[0];
  }

  getDashboardQueueLoad(
    scope: ReportScope,
    limit: number,
  ): Promise<QueueLoadRow[]> {
    const { siteFilter, queueFilter, params } = this.buildScope(scope);
    params.push(limit);
    return this.dataSource.query<QueueLoadRow[]>(
      `SELECT q.queue_id, q.queue_code, q.queue_name, s.site_id, s.site_name,
       CASE WHEN (q.appointments_enabled IS TRUE OR (q.appointments_enabled IS NULL AND s.default_appointments_enabled IS TRUE))
         THEN 'hybrid' ELSE 'walkin' END AS queue_type,
       COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active)::int AS waiting_count,
       COALESCE((SELECT st.tier_name FROM dori_customer dc
         JOIN dori_service_tier st ON st.tier_id = dc.tier_id
         WHERE dc.queue_id = q.queue_id AND dc.status = 'waiting' AND dc.is_active
         GROUP BY st.tier_name ORDER BY COUNT(*) DESC LIMIT 1), 'free') AS dominant_tier
       FROM dori_site_queue_thread q JOIN dori_site s ON s.site_id = q.site_id
       LEFT JOIN dori_customer c ON c.queue_id = q.queue_id AND c.status = 'waiting' AND c.is_active
       WHERE ${siteFilter} AND ${queueFilter}
       GROUP BY q.queue_id, q.queue_code, q.queue_name, s.site_id, s.site_name,
         q.appointments_enabled, s.default_appointments_enabled
       ORDER BY waiting_count DESC, q.queue_id ASC LIMIT $${params.length}`,
      params,
    );
  }

  private buildScope(scope: ReportScope) {
    const params: unknown[] = [];
    let siteFilter = 's.is_active = TRUE';
    let queueFilter = 'q.is_active = TRUE';
    if (scope.siteId !== undefined) {
      params.push(scope.siteId);
      siteFilter += ` AND s.site_id = $${params.length}`;
    } else if (scope.siteIds?.length) {
      params.push(scope.siteIds);
      siteFilter += ` AND s.site_id = ANY($${params.length})`;
    } else if (scope.queueIds?.length) {
      params.push(scope.queueIds);
      queueFilter += ` AND q.queue_id = ANY($${params.length})`;
    }
    return { siteFilter, queueFilter, params };
  }
}
