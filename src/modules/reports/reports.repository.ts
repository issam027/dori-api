import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface QueueIdentityRow {
  queue_id?: number;
  site_id?: number;
  queue_name: string;
  queue_code: string;
  site_name: string;
  timezone?: string;
}

export interface SeriesRow extends Record<string, unknown> {
  row_type: 'summary' | 'bucket' | 'group_summary' | 'group_bucket';
  period_start: string | null;
  period_end: string | null;
  group_key: string | null;
  group_label: string | null;
  timezone: string | null;
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

export interface MonitoringSeriesData {
  totals: Record<string, unknown>;
  series: Array<Record<string, unknown>>;
  byQueue: Array<Record<string, unknown>>;
  byUser: Array<Record<string, unknown>>;
  byTier: Array<Record<string, unknown>>;
  byEntryType: Array<Record<string, unknown>>;
  byStatus: Array<Record<string, unknown>>;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findQueueIdentity(queueId: number): Promise<QueueIdentityRow | null> {
    const rows = await this.dataSource.query<QueueIdentityRow[]>(
      `SELECT q.queue_name, q.queue_code, s.site_name
       FROM dori_queue q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  findScopeIdentities(input: {
    queueIds?: number[];
    siteId?: number;
  }): Promise<QueueIdentityRow[]> {
    const params: unknown[] = [];
    let where = '1=1';
    if (input.queueIds) {
      params.push(input.queueIds);
      where += ` AND q.queue_id = ANY($${params.length})`;
    }
    if (input.siteId !== undefined) {
      params.push(input.siteId);
      where += ` AND s.site_id = $${params.length}`;
    }
    return this.dataSource.query(
      `SELECT q.queue_id, q.queue_code, q.queue_name, s.site_id, s.site_name, s.timezone
       FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id
       WHERE ${where} ORDER BY q.queue_id`,
      params,
    );
  }

  getSeries(input: {
    queueIds: number[];
    dateFrom: string;
    dateTo: string;
    granularity: 'day' | 'week' | 'month';
    includeEmpty: boolean;
    groupBy?: 'site' | 'queue' | 'tier' | 'entryType' | 'hour' | 'weekday';
  }): Promise<SeriesRow[]> {
    const bucketExpressions = {
      day: 'r.business_date',
      week: `date_trunc('week', r.business_date)::date`,
      month: `date_trunc('month', r.business_date)::date`,
    } as const;
    const intervalExpressions = {
      day: `interval '1 day'`,
      week: `interval '1 week'`,
      month: `interval '1 month'`,
    } as const;
    const groupExpressions = {
      site: [`s.site_id::text`, 's.site_name', 's.timezone'],
      queue: [`q.queue_id::text`, 'q.queue_name', 's.timezone'],
      tier: [`t.tier_id::text`, 't.tier_name', 's.timezone'],
      entryType: ['r.entry_type', 'r.entry_type', 's.timezone'],
      hour: [
        `to_char(r.scheduled_time AT TIME ZONE s.timezone, 'HH24')`,
        `to_char(r.scheduled_time AT TIME ZONE s.timezone, 'HH24')`,
        's.timezone',
      ],
      weekday: [
        `extract(isodow from r.business_date)::text`,
        `extract(isodow from r.business_date)::text`,
        's.timezone',
      ],
    } as const;
    const bucket = bucketExpressions[input.granularity];
    const stride = intervalExpressions[input.granularity];
    const metrics = (alias: string) => `
      COUNT(${alias}.registration_id)::int AS registered,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.entry_type='walkin')::int AS walkin,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.entry_type='appointment')::int AS appointments,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.status='served')::int AS served,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.status='no_show')::int AS no_show,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.status='expired')::int AS expired,
      COUNT(${alias}.registration_id) FILTER (WHERE ${alias}.status='cancelled')::int AS cancelled,
      ROUND(AVG(EXTRACT(EPOCH FROM (${alias}.called_at-${alias}.priority_reference_time))/60) FILTER (WHERE ${alias}.called_at IS NOT NULL)::numeric, 2) AS avg_wait,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (${alias}.called_at-${alias}.priority_reference_time))/60) FILTER (WHERE ${alias}.called_at IS NOT NULL)::numeric, 2) AS median_wait,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (${alias}.called_at-${alias}.priority_reference_time))/60) FILTER (WHERE ${alias}.called_at IS NOT NULL)::numeric, 2) AS p90_wait,
      ROUND(AVG(EXTRACT(EPOCH FROM (${alias}.served_at-${alias}.called_at))/60) FILTER (WHERE ${alias}.served_at IS NOT NULL AND ${alias}.called_at IS NOT NULL)::numeric, 2) AS avg_service,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (${alias}.served_at-${alias}.called_at))/60) FILTER (WHERE ${alias}.served_at IS NOT NULL AND ${alias}.called_at IS NOT NULL)::numeric, 2) AS median_service,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (${alias}.served_at-${alias}.called_at))/60) FILTER (WHERE ${alias}.served_at IS NOT NULL AND ${alias}.called_at IS NOT NULL)::numeric, 2) AS p90_service`;
    const group = input.groupBy ? groupExpressions[input.groupBy] : null;
    const groupSql = group
      ? `UNION ALL
         SELECT 'group_summary', NULL::date, NULL::date, ${group[0]}, ${group[1]},
           CASE WHEN COUNT(DISTINCT ${group[2]})=1 THEN MIN(${group[2]}) ELSE NULL END, ${metrics('r')}
         FROM scoped r JOIN dori_queue q ON q.queue_id=r.queue_id
         JOIN dori_site s ON s.site_id=q.site_id LEFT JOIN dori_service_tier t ON t.tier_id=r.tier_id
         GROUP BY ${group[0]}, ${group[1]}
         UNION ALL
         SELECT 'group_bucket', ${bucket}, LEAST($3::date, (${bucket}+${stride}-interval '1 day')::date),
           ${group[0]}, ${group[1]}, CASE WHEN COUNT(DISTINCT ${group[2]})=1 THEN MIN(${group[2]}) ELSE NULL END, ${metrics('r')}
         FROM scoped r JOIN dori_queue q ON q.queue_id=r.queue_id
         JOIN dori_site s ON s.site_id=q.site_id LEFT JOIN dori_service_tier t ON t.tier_id=r.tier_id
         GROUP BY ${bucket}, ${group[0]}, ${group[1]}`
      : '';
    return this.dataSource.query(
      `WITH scoped AS (
         SELECT * FROM dori_registration r
         WHERE r.queue_id=ANY($1) AND r.business_date BETWEEN $2 AND $3
       ), periods AS (
         SELECT generate_series(date_trunc('${input.granularity}', $2::date)::date,
           date_trunc('${input.granularity}', $3::date)::date, ${stride})::date AS period_start
       )
       SELECT 'summary' AS row_type, NULL::date AS period_start, NULL::date AS period_end,
         NULL::text AS group_key, NULL::text AS group_label, NULL::text AS timezone, ${metrics('r')}
       FROM scoped r
       UNION ALL
       SELECT 'bucket', p.period_start, LEAST($3::date, (p.period_start+${stride}-interval '1 day')::date),
         NULL, NULL, NULL, ${metrics('r')}
       FROM periods p LEFT JOIN scoped r ON ${bucket}=p.period_start
       GROUP BY p.period_start
       ${input.includeEmpty ? '' : 'HAVING COUNT(r.registration_id)>0'}
       ${groupSql}
       ORDER BY row_type, group_key NULLS FIRST, period_start NULLS FIRST`,
      [input.queueIds, input.dateFrom, input.dateTo],
    );
  }

  async getMonitoringSeries(input: {
    queueIds: number[];
    userIds?: number[];
    tierIds?: number[];
    statuses?: string[];
    entryTypes?: string[];
    from: string;
    to: string;
    bucket: 'hour' | 'day' | 'week' | 'month';
    timezone: string;
  }): Promise<MonitoringSeriesData> {
    const scopedParams = [
      input.queueIds,
      input.from,
      input.to,
      input.userIds ?? null,
      input.tierIds ?? null,
      input.statuses ?? null,
      input.entryTypes ?? null,
    ];
    const seriesParams = [...scopedParams, input.timezone];
    const scoped = `WITH scoped AS (
      SELECT r.* FROM dori_registration r
      WHERE r.queue_id = ANY($1)
        AND ($4::int[] IS NULL OR r.served_by_user_id = ANY($4))
        AND ($5::int[] IS NULL OR r.tier_id = ANY($5))
        AND ($6::text[] IS NULL OR r.status = ANY($6))
        AND ($7::text[] IS NULL OR r.entry_type = ANY($7))
        AND (r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz
          OR r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz
          OR r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)
    )`;
    const metrics = `
      COUNT(*) FILTER (WHERE r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz)::int AS registered,
      COUNT(*) FILTER (WHERE r.status = 'served' AND r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz)::int AS served,
      COUNT(*) FILTER (WHERE r.status = 'no_show' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS no_show,
      COUNT(*) FILTER (WHERE r.status = 'cancelled' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS cancelled,
      ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at - COALESCE(r.checked_in_at, r.priority_reference_time)))/60)
        FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz
          AND COALESCE(r.checked_in_at, r.priority_reference_time) IS NOT NULL)::numeric, 2) AS average_wait_minutes,
      ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)
        FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz
          AND r.called_at IS NOT NULL)::numeric, 2) AS average_service_minutes`;
    const bucketExpression = `date_trunc('${input.bucket}', event_at AT TIME ZONE $8)`;
    const [totalsRows, series, byQueue, byUser, byTier, byEntryType, byStatus] =
      await Promise.all([
        this.dataSource.query(
          `${scoped} SELECT ${metrics} FROM scoped r`,
          scopedParams,
        ),
        this.dataSource.query(
          `${scoped}, events AS (
            SELECT created_at AS event_at, 'registered' AS event_type, registration_id FROM scoped
            UNION ALL SELECT served_at, 'served', registration_id FROM scoped WHERE status='served' AND served_at IS NOT NULL
            UNION ALL SELECT closed_at, 'no_show', registration_id FROM scoped WHERE status='no_show' AND closed_at IS NOT NULL
            UNION ALL SELECT closed_at, 'cancelled', registration_id FROM scoped WHERE status='cancelled' AND closed_at IS NOT NULL
          ), periods AS (
            SELECT generate_series(date_trunc('${input.bucket}', $2::timestamptz AT TIME ZONE $8),
              date_trunc('${input.bucket}', ($3::timestamptz - interval '1 microsecond') AT TIME ZONE $8),
              interval '1 ${input.bucket}') AS period_start
          )
          SELECT p.period_start,
            COUNT(e.registration_id) FILTER (WHERE e.event_type='registered')::int AS registered,
            COUNT(e.registration_id) FILTER (WHERE e.event_type='served')::int AS served,
            COUNT(e.registration_id) FILTER (WHERE e.event_type='no_show')::int AS no_show,
            COUNT(e.registration_id) FILTER (WHERE e.event_type='cancelled')::int AS cancelled,
            m.average_wait_minutes, m.average_service_minutes
          FROM periods p LEFT JOIN events e ON ${bucketExpression}=p.period_start
            AND e.event_at >= $2::timestamptz AND e.event_at < $3::timestamptz
          LEFT JOIN LATERAL (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at-COALESCE(r.checked_in_at,r.priority_reference_time)))/60)::numeric,2) AS average_wait_minutes,
              ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)::numeric,2) AS average_service_minutes
            FROM scoped r WHERE date_trunc('${input.bucket}', COALESCE(r.served_at,r.called_at) AT TIME ZONE $8)=p.period_start
              AND r.called_at IS NOT NULL
          ) m ON TRUE GROUP BY p.period_start,m.average_wait_minutes,m.average_service_minutes ORDER BY p.period_start`,
          seriesParams,
        ),
        this.dataSource.query(
          `${scoped} SELECT q.queue_id, q.queue_name, ${metrics} FROM scoped r
           JOIN dori_queue q ON q.queue_id=r.queue_id GROUP BY q.queue_id,q.queue_name ORDER BY q.queue_id`,
          scopedParams,
        ),
        this.dataSource.query(
          `${scoped} SELECT u.user_id, COALESCE(u.full_name,u.username) AS display_name,
           COUNT(*) FILTER (WHERE r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz)::int AS registered,
           COUNT(*) FILTER (WHERE r.status='served' AND r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz)::int AS served,
           COUNT(*) FILTER (WHERE r.status='no_show' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS no_show,
           ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60) FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz AND r.called_at IS NOT NULL)::numeric,2) AS average_service_minutes
           FROM scoped r JOIN dori_user u ON u.user_id=r.served_by_user_id
           GROUP BY u.user_id,u.full_name,u.username ORDER BY u.user_id`,
          scopedParams,
        ),
        this.dataSource.query(
          `${scoped} SELECT t.tier_id,t.tier_code,t.tier_name,
           COUNT(*) FILTER (WHERE r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz)::int AS registered,
           COUNT(*) FILTER (WHERE r.status='served' AND r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz)::int AS served,
           COUNT(*) FILTER (WHERE r.status='no_show' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS no_show,
           ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at-COALESCE(r.checked_in_at,r.priority_reference_time)))/60) FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz)::numeric,2) AS average_wait_minutes
           FROM scoped r JOIN dori_service_tier t ON t.tier_id=r.tier_id
           GROUP BY t.tier_id,t.tier_code,t.tier_name ORDER BY t.tier_id`,
          scopedParams,
        ),
        this.dataSource.query(
          `${scoped} SELECT entry_type,COUNT(*)::int AS count FROM scoped
           WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz GROUP BY entry_type ORDER BY entry_type`,
          scopedParams,
        ),
        this.dataSource.query(
          `${scoped} SELECT status,COUNT(*)::int AS count FROM scoped
           WHERE CASE
             WHEN status='served' THEN served_at
             WHEN status IN ('no_show','cancelled','expired') THEN closed_at
             ELSE created_at
           END >= $2::timestamptz
           AND CASE
             WHEN status='served' THEN served_at
             WHEN status IN ('no_show','cancelled','expired') THEN closed_at
             ELSE created_at
           END < $3::timestamptz
           GROUP BY status ORDER BY status`,
          scopedParams,
        ),
      ]);
    return {
      totals: totalsRows[0] ?? {},
      series,
      byQueue,
      byUser,
      byTier,
      byEntryType,
      byStatus,
    };
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
       FROM dori_registration WHERE queue_id = $1 AND business_date = $2`,
      [queueId, date],
    );
    return rows[0];
  }
}
