export interface MonitoringSeriesInput {
  queueIds: string[];
  userIds?: string[];
  tierIds?: string[];
  statuses?: string[];
  entryTypes?: string[];
  from: string;
  to: string;
  bucket: 'hour' | 'day' | 'week' | 'month';
  timezone: string;
}

export function monitoringSeriesQueries(input: MonitoringSeriesInput) {
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
      SELECT r.registration_id, r.queue_id, r.tier_id, r.served_by_user_id, r.entry_type, r.status,
        r.created_at, r.called_at, r.checked_in_at, r.served_at, r.closed_at
      FROM dorify.dori_registration r
      WHERE r.queue_id = ANY($1)
        AND ($4::uuid[] IS NULL OR r.served_by_user_id = ANY($4))
        AND ($5::uuid[] IS NULL OR r.tier_id = ANY($5))
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
      ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at))/60)
        FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz
          AND r.checked_in_at IS NOT NULL)::numeric, 2) AS average_wait_minutes,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at-r.checked_in_at))/60)
        FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz
          AND r.checked_in_at IS NOT NULL)::numeric, 2) AS median_wait_minutes,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at-r.checked_in_at))/60)
        FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz
          AND r.checked_in_at IS NOT NULL)::numeric, 2) AS p90_wait_minutes,
      ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)
        FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz
          AND r.called_at IS NOT NULL)::numeric, 2) AS average_service_minutes,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)
        FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz
          AND r.called_at IS NOT NULL)::numeric, 2) AS median_service_minutes,
      ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)
        FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz
          AND r.called_at IS NOT NULL)::numeric, 2) AS p90_service_minutes`;
  const bucketExpression = `date_trunc('${input.bucket}', event_at AT TIME ZONE $8)`;

  const statement = (sql: string, parameters: unknown[]) => ({
    sql,
    parameters,
  });
  return [
    statement(`${scoped} SELECT ${metrics} FROM scoped r`, scopedParams),
    // Optimisé : les moyennes par période sont calculées en un seul
    // passage (GROUP BY) au lieu d'un LEFT JOIN LATERAL qui rescannait
    // tout "scoped" pour chaque période (coût = périodes x lignes).
    statement(
      `${scoped}, events AS (
            SELECT r.queue_id, e.event_at, e.event_type
            FROM scoped r
            CROSS JOIN LATERAL (VALUES
              (r.created_at, 'registered'),
              (CASE WHEN r.status='served' THEN r.served_at END, 'served'),
              (CASE WHEN r.status='no_show' THEN r.closed_at END, 'no_show'),
              (CASE WHEN r.status='cancelled' THEN r.closed_at END, 'cancelled')
            ) e(event_at, event_type)
            WHERE e.event_at >= $2::timestamptz AND e.event_at < $3::timestamptz
          ), periods AS (
            SELECT generate_series(date_trunc('${input.bucket}', $2::timestamptz AT TIME ZONE $8),
              date_trunc('${input.bucket}', ($3::timestamptz - interval '1 microsecond') AT TIME ZONE $8),
              interval '1 ${input.bucket}') AS period_start
          ), counts AS (
            SELECT ${bucketExpression} AS period_start,
              COUNT(*) FILTER (WHERE event_type='registered')::int AS registered,
              COUNT(*) FILTER (WHERE event_type='served')::int AS served,
              COUNT(*) FILTER (WHERE event_type='no_show')::int AS no_show,
              COUNT(*) FILTER (WHERE event_type='cancelled')::int AS cancelled
            FROM events
            WHERE event_at >= $2::timestamptz AND event_at < $3::timestamptz
            GROUP BY 1
          ), averages AS (
            SELECT date_trunc('${input.bucket}', COALESCE(r.served_at, r.called_at) AT TIME ZONE $8) AS period_start,
              ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at))/60)::numeric, 2) AS average_wait_minutes,
              ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at-r.checked_in_at))/60)::numeric, 2) AS median_wait_minutes,
              ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at-r.checked_in_at))/60)::numeric, 2) AS p90_wait_minutes,
              ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at - r.called_at))/60)::numeric, 2) AS average_service_minutes,
              ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)::numeric, 2) AS median_service_minutes,
              ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60)::numeric, 2) AS p90_service_minutes
            FROM scoped r
            WHERE r.called_at IS NOT NULL
            GROUP BY 1
          )
          SELECT p.period_start,
            COALESCE(c.registered, 0) AS registered,
            COALESCE(c.served, 0) AS served,
            COALESCE(c.no_show, 0) AS no_show,
            COALESCE(c.cancelled, 0) AS cancelled,
            a.average_wait_minutes, a.median_wait_minutes, a.p90_wait_minutes,
            a.average_service_minutes, a.median_service_minutes, a.p90_service_minutes
          FROM periods p
          LEFT JOIN counts c ON c.period_start = p.period_start
          LEFT JOIN averages a ON a.period_start = p.period_start
          ORDER BY p.period_start`,
      seriesParams,
    ),
    statement(
      `${scoped} SELECT q.queue_id, q.queue_name, ${metrics} FROM scoped r
           JOIN dorify.dori_queue q ON q.queue_id=r.queue_id GROUP BY q.queue_id,q.queue_name ORDER BY q.queue_id`,
      scopedParams,
    ),
    statement(
      `${scoped}, events AS (
            SELECT r.queue_id, e.event_at, e.event_type
            FROM scoped r
            CROSS JOIN LATERAL (VALUES
              (r.created_at, 'registered'),
              (CASE WHEN r.status='served' THEN r.served_at END, 'served'),
              (CASE WHEN r.status='no_show' THEN r.closed_at END, 'no_show'),
              (CASE WHEN r.status='cancelled' THEN r.closed_at END, 'cancelled')
            ) e(event_at, event_type)
            WHERE e.event_at >= $2::timestamptz AND e.event_at < $3::timestamptz
          ), counts AS (
            SELECT queue_id, ${bucketExpression} AS period_start,
              COUNT(*) FILTER (WHERE event_type='registered')::int AS registered,
              COUNT(*) FILTER (WHERE event_type='served')::int AS served,
              COUNT(*) FILTER (WHERE event_type='no_show')::int AS no_show,
              COUNT(*) FILTER (WHERE event_type='cancelled')::int AS cancelled
            FROM events
            WHERE event_at >= $2::timestamptz AND event_at < $3::timestamptz
            GROUP BY queue_id, period_start
          ), averages AS (
            SELECT queue_id,
              date_trunc('${input.bucket}', COALESCE(served_at, called_at) AT TIME ZONE $8) AS period_start,
              ROUND(AVG(EXTRACT(EPOCH FROM (called_at - checked_in_at))/60)::numeric, 2) AS average_wait_minutes,
              ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (called_at-checked_in_at))/60)::numeric, 2) AS median_wait_minutes,
              ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (called_at-checked_in_at))/60)::numeric, 2) AS p90_wait_minutes,
              ROUND(AVG(EXTRACT(EPOCH FROM (served_at - called_at))/60)::numeric, 2) AS average_service_minutes,
              ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (served_at-called_at))/60)::numeric, 2) AS median_service_minutes,
              ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (served_at-called_at))/60)::numeric, 2) AS p90_service_minutes
            FROM scoped
            WHERE called_at IS NOT NULL
            GROUP BY queue_id, period_start
          )
          SELECT c.queue_id, c.period_start, c.registered, c.served, c.no_show, c.cancelled,
            a.average_wait_minutes, a.median_wait_minutes, a.p90_wait_minutes,
            a.average_service_minutes, a.median_service_minutes, a.p90_service_minutes
          FROM counts c
          LEFT JOIN averages a ON a.queue_id=c.queue_id AND a.period_start=c.period_start
          ORDER BY c.queue_id, c.period_start`,
      seriesParams,
    ),
    statement(
      `${scoped} SELECT u.user_id, COALESCE(u.full_name,u.username) AS display_name,
           COUNT(*) FILTER (WHERE r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz)::int AS registered,
           COUNT(*) FILTER (WHERE r.status='served' AND r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz)::int AS served,
           COUNT(*) FILTER (WHERE r.status='no_show' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS no_show,
           ROUND(AVG(EXTRACT(EPOCH FROM (r.served_at-r.called_at))/60) FILTER (WHERE r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz AND r.called_at IS NOT NULL)::numeric,2) AS average_service_minutes
           FROM scoped r JOIN dorify.dori_user u ON u.user_id=r.served_by_user_id
           GROUP BY u.user_id,u.full_name,u.username ORDER BY u.user_id`,
      scopedParams,
    ),
    statement(
      `${scoped} SELECT t.tier_id,t.tier_code,t.tier_name,
           COUNT(*) FILTER (WHERE r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz)::int AS registered,
           COUNT(*) FILTER (WHERE r.status='served' AND r.served_at >= $2::timestamptz AND r.served_at < $3::timestamptz)::int AS served,
           COUNT(*) FILTER (WHERE r.status='no_show' AND r.closed_at >= $2::timestamptz AND r.closed_at < $3::timestamptz)::int AS no_show,
           ROUND(AVG(EXTRACT(EPOCH FROM (r.called_at-r.checked_in_at))/60) FILTER (WHERE r.called_at >= $2::timestamptz AND r.called_at < $3::timestamptz)::numeric,2) AS average_wait_minutes
           FROM scoped r JOIN dorify.dori_service_tier t ON t.tier_id=r.tier_id
           GROUP BY t.tier_id,t.tier_code,t.tier_name ORDER BY t.tier_id`,
      scopedParams,
    ),
    statement(
      `${scoped} SELECT entry_type,COUNT(*)::int AS count FROM scoped
           WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz GROUP BY entry_type ORDER BY entry_type`,
      scopedParams,
    ),
    statement(
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
  ];
}
