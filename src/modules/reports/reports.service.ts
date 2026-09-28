import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
  ) { }

  async getDailyQueueReport(
    queueId: number,
    date: string,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const queueRes = await this.dataSource.query(
      `SELECT q.queue_name, q.queue_code, s.site_name
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );

    if (!queueRes || queueRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const { queue_name, queue_code, site_name } = queueRes[0];

    const stats = await this.dataSource.query(
      `SELECT
         COUNT(*)::int as total_registered,
         COUNT(*) FILTER (WHERE entry_type = 'walkin')::int as total_walkin,
         COUNT(*) FILTER (WHERE entry_type = 'appointment')::int as total_appointment,
         COUNT(*) FILTER (WHERE status = 'served')::int as total_served,
         COUNT(*) FILTER (WHERE status = 'no_show')::int as total_no_show,
         COUNT(*) FILTER (WHERE status = 'expired')::int as total_expired,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int as total_cancelled,
         ROUND(AVG(EXTRACT(EPOCH FROM (called_at - priority_reference_time))/60) FILTER (WHERE status = 'served' AND called_at IS NOT NULL)::numeric, 1) as avg_wait_minutes,
         ROUND(AVG(EXTRACT(EPOCH FROM (served_at - called_at))/60) FILTER (WHERE status = 'served' AND served_at IS NOT NULL AND called_at IS NOT NULL)::numeric, 1) as avg_service_minutes
       FROM dori_customer
       WHERE queue_id = $1 AND business_date = $2`,
      [queueId, date],
    );

    const row = stats[0] || {};
    const totalServed = row.total_served || 0;
    const totalNoShow = row.total_no_show || 0;
    const handledTotal = totalServed + totalNoShow;
    const totalOpen = row.total_registered - row.total_expired - row.total_cancelled - handledTotal;
    const noShowRate =
      handledTotal > 0 ? Number((totalNoShow / handledTotal).toFixed(3)) : 0;

    return {
      queueId,
      queueCode: queue_code,
      queueName: queue_name,
      siteName: site_name,
      businessDate: date,
      volume: {
        totalRegistered: row.total_registered || 0,
        totalWalkin: row.total_walkin || 0,
        totalAppointment: row.total_appointment || 0,
        totalServed,
        totalNoShow,
        totalExpired: row.total_expired || 0,
        totalCancelled: row.total_cancelled || 0,
        totalOpen,
      },
      kpis: {
        noShowRate,
        averageWaitMinutes: Number(row.avg_wait_minutes || 0),
        averageServiceMinutes: Number(row.avg_service_minutes || 0),
      },
    };
  }

  async getDashboardSummary(siteId?: number, user?: AuthenticatedUser) {
    const scope = user
      ? await this.scopeService.getUserScope(user)
      : { isGlobal: true, siteIds: [], queueIds: [] };

    if (siteId && user) {
      await this.scopeService.checkSiteAccess(user, siteId);
    }

    const params: any[] = [];
    let siteFilter = 's.is_active = TRUE';
    let queueFilter = 'q.is_active = TRUE';

    if (siteId) {
      params.push(siteId);
      siteFilter += ` AND s.site_id = $${params.length}`;
    } else if (!scope.isGlobal) {
      if (scope.siteIds.length > 0) {
        params.push(scope.siteIds);
        siteFilter += ` AND s.site_id = ANY($${params.length})`;
      } else if (scope.queueIds.length > 0) {
        params.push(scope.queueIds);
        queueFilter += ` AND q.queue_id = ANY($${params.length})`;
      } else {
        return {
          activeSites: 0,
          activeQueues: 0,
          waitingTotal: 0,
          waitingWalkin: 0,
          waitingAppointment: 0,
          appointmentsToday: 0,
        };
      }
    }

    const sql = `
      SELECT
        COUNT(DISTINCT s.site_id)::int as active_sites,
        COUNT(DISTINCT q.queue_id)::int as active_queues,
        COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active = TRUE)::int as waiting_total,
        COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active = TRUE AND c.entry_type = 'walkin')::int as waiting_walkin,
        COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active = TRUE AND c.entry_type = 'appointment')::int as waiting_appointment,
        COUNT(c.customer_id) FILTER (WHERE c.entry_type = 'appointment' AND c.is_active = TRUE AND c.business_date = CURRENT_DATE)::int as appointments_today
      FROM dori_site s
      LEFT JOIN dori_site_queue_thread q ON q.site_id = s.site_id AND ${queueFilter}
      LEFT JOIN dori_customer c ON c.queue_id = q.queue_id AND c.is_active = TRUE
      WHERE ${siteFilter}
    `;

    const res = await this.dataSource.query(sql, params);
    const row = res[0] || {};

    return {
      activeSites: row.active_sites || 0,
      activeQueues: row.active_queues || 0,
      waitingTotal: row.waiting_total || 0,
      waitingWalkin: row.waiting_walkin || 0,
      waitingAppointment: row.waiting_appointment || 0,
      appointmentsToday: row.appointments_today || 0,
    };
  }

  async getDashboardQueueLoad(
    limit: number = 4,
    siteId?: number,
    user?: AuthenticatedUser,
  ) {
    const scope = user
      ? await this.scopeService.getUserScope(user)
      : { isGlobal: true, siteIds: [], queueIds: [] };

    if (siteId && user) {
      await this.scopeService.checkSiteAccess(user, siteId);
    }

    const params: any[] = [];
    let siteFilter = 's.is_active = TRUE';
    let queueFilter = 'q.is_active = TRUE';

    if (siteId) {
      params.push(siteId);
      siteFilter += ` AND s.site_id = $${params.length}`;
    } else if (!scope.isGlobal) {
      if (scope.siteIds.length > 0) {
        params.push(scope.siteIds);
        siteFilter += ` AND s.site_id = ANY($${params.length})`;
      } else if (scope.queueIds.length > 0) {
        params.push(scope.queueIds);
        queueFilter += ` AND q.queue_id = ANY($${params.length})`;
      } else {
        return [];
      }
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT
        q.queue_id,
        q.queue_code,
        q.queue_name,
        s.site_id,
        s.site_name,
        CASE WHEN (q.appointments_enabled IS TRUE OR (q.appointments_enabled IS NULL AND s.default_appointments_enabled IS TRUE))
             THEN 'hybrid'
             ELSE 'walkin'
        END as queue_type,
        COUNT(c.customer_id) FILTER (WHERE c.status = 'waiting' AND c.is_active = TRUE)::int as waiting_count,
        COALESCE((
          SELECT st.tier_name
          FROM dori_customer dc
          JOIN dori_service_tier st ON st.tier_id = dc.tier_id
          WHERE dc.queue_id = q.queue_id AND dc.status = 'waiting' AND dc.is_active = TRUE
          GROUP BY st.tier_name
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ), 'free') as dominant_tier
      FROM dori_site_queue_thread q
      JOIN dori_site s ON s.site_id = q.site_id
      LEFT JOIN dori_customer c ON c.queue_id = q.queue_id AND c.status = 'waiting' AND c.is_active = TRUE
      WHERE ${siteFilter} AND ${queueFilter}
      GROUP BY q.queue_id, q.queue_code, q.queue_name, s.site_id, s.site_name, q.appointments_enabled, s.default_appointments_enabled
      ORDER BY waiting_count DESC, q.queue_id ASC
      LIMIT ${limitParam}
    `;

    const rows = await this.dataSource.query(sql, params);
    return rows.map((r: any) => ({
      queueId: r.queue_id,
      queueCode: r.queue_code,
      queueName: r.queue_name,
      siteId: r.site_id,
      siteName: r.site_name,
      queueType: r.queue_type,
      waitingCount: r.waiting_count || 0,
      dominantTier: r.dominant_tier,
    }));
  }
}
