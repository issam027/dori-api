import {
  monitoringSeriesQueries,
  MonitoringSeriesInput,
} from './monitoring-series.query';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface QueueIdentityRow {
  queue_id?: string;
  site_id?: string;
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

export interface MonitoringSeriesData {
  totals: Record<string, unknown>;
  series: Array<Record<string, unknown>>;
  byQueue: Array<Record<string, unknown>>;
  byQueueSeries: Array<Record<string, unknown>>;
  byUser: Array<Record<string, unknown>>;
  byTier: Array<Record<string, unknown>>;
  byEntryType: Array<Record<string, unknown>>;
  byStatus: Array<Record<string, unknown>>;
}

const REGISTRATION_COLUMNS = `registration_id, person_id, queue_id, tier_id, business_date,
  ticket_number, entry_type, scheduled_time, appointment_status, checked_in_at,
  priority_reference_time, status, called_at, served_at, closed_at, carried_over_from_date,
  served_by_session_id, served_by_user_id, registration_tracking_token,
  registration_tracking_token_valid_until, payment_status, payment_amount, payment_currency,
  payment_method, paid_at, payment_reference, language_preference, is_active, deleted_at,
  created_by_user_id, updated_by_user_id, created_at, updated_at`;
const registrationColumns = (alias: string) =>
  REGISTRATION_COLUMNS.split(',')
    .map((column) => `${alias}.${column.trim()}`)
    .join(', ');

@Injectable()
export class ReportsRepository {
  constructor(private readonly dataSource: DataSource) {}

  findScopeIdentities(input: {
    queueIds?: string[];
    siteId?: string;
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
       FROM dorify.dori_queue q JOIN dorify.dori_site s ON s.site_id=q.site_id
       WHERE ${where} ORDER BY q.queue_id`,
      params,
    );
  }

  getSeries(input: {
    queueIds: string[];
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
         FROM scoped r JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
         JOIN dorify.dori_site s ON s.site_id=q.site_id LEFT JOIN dorify.dori_service_tier t ON t.tier_id=r.tier_id
         GROUP BY ${group[0]}, ${group[1]}
         UNION ALL
         SELECT 'group_bucket', ${bucket}, LEAST($3::date, (${bucket}+${stride}-interval '1 day')::date),
           ${group[0]}, ${group[1]}, CASE WHEN COUNT(DISTINCT ${group[2]})=1 THEN MIN(${group[2]}) ELSE NULL END, ${metrics('r')}
         FROM scoped r JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
         JOIN dorify.dori_site s ON s.site_id=q.site_id LEFT JOIN dorify.dori_service_tier t ON t.tier_id=r.tier_id
         GROUP BY ${bucket}, ${group[0]}, ${group[1]}`
      : '';
    return this.dataSource.query(
      `WITH scoped AS (
         SELECT ${registrationColumns('r')} FROM dorify.dori_registration r
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

  async getMonitoringSeries(
    input: MonitoringSeriesInput,
  ): Promise<MonitoringSeriesData> {
    const [
      totalsRows,
      series,
      byQueue,
      byQueueSeries,
      byUser,
      byTier,
      byEntryType,
      byStatus,
    ] = await Promise.all(
      monitoringSeriesQueries(input).map(({ sql, parameters }) =>
        this.dataSource.query(sql, parameters),
      ),
    );
    return {
      totals: totalsRows[0] ?? {},
      series,
      byQueue,
      byQueueSeries,
      byUser,
      byTier,
      byEntryType,
      byStatus,
    };
  }
}
