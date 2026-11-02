-- Canonical operational rules shared by the API, workers and outbound projection.
-- Historical reports intentionally remain measurements, not forecasts.
CREATE OR REPLACE FUNCTION dorify.queue_operational_candidates(queue_ids UUID[],observed TIMESTAMPTZ)
RETURNS TABLE(registration_id UUID,queue_id UUID,business_date DATE,called_early BOOLEAN,call_sort_time TIMESTAMPTZ,score NUMERIC)
LANGUAGE SQL STABLE AS $$
    SELECT r.registration_id,r.queue_id,r.business_date,
      (r.entry_type='appointment' AND r.scheduled_time>observed) AS called_early,
      CASE WHEN r.entry_type='appointment' AND r.scheduled_time>observed THEN r.scheduled_time ELSE r.priority_reference_time END AS call_sort_time,
      CASE WHEN r.entry_type='appointment' AND r.scheduled_time>observed THEN 0::numeric ELSE
        ROUND((CASE WHEN r.entry_type='appointment'
          THEN COALESCE(q.base_weight_appointment,s.default_base_weight_appointment,60)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60 * COALESCE(q.escalation_rate_appointment,s.default_escalation_rate_appointment,1)
          ELSE COALESCE(q.base_weight_walkin,s.default_base_weight_walkin,0)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60 * COALESCE(q.escalation_rate_walkin,s.default_escalation_rate_walkin,1)
          END)::numeric,2) END AS score
    FROM dorify.dori_registration r
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    JOIN dorify.dori_site s ON s.site_id=q.site_id
    WHERE r.queue_id=ANY(queue_ids) AND r.status='waiting' AND r.is_active
      AND (r.entry_type='walkin' OR r.appointment_status='checked_in')
$$;

CREATE OR REPLACE FUNCTION dorify.queue_operational_ranking(queue_ids UUID[],observed TIMESTAMPTZ)
RETURNS TABLE(registration_id UUID,queue_id UUID,business_date DATE,"position" INT,score NUMERIC,called_early BOOLEAN,call_sort_time TIMESTAMPTZ)
LANGUAGE SQL STABLE AS $$
  SELECT registration_id,queue_id,business_date,
    ROW_NUMBER() OVER(PARTITION BY queue_id,business_date ORDER BY called_early,score DESC,call_sort_time,registration_id)::int,
    score,called_early,call_sort_time FROM dorify.queue_operational_candidates(queue_ids,observed)
$$;

-- Position view of the canonical ranking, consumed by ticket estimates.
CREATE OR REPLACE FUNCTION dorify.queue_operational_positions(queue_ids UUID[], observed TIMESTAMPTZ)
RETURNS TABLE(registration_id UUID, queue_id UUID, business_date DATE, "position" INT)
LANGUAGE SQL STABLE AS $$
  SELECT registration_id,queue_id,business_date,"position" FROM dorify.queue_operational_ranking(queue_ids,observed)
$$;

CREATE OR REPLACE FUNCTION dorify.queue_estimate_minutes(people_ahead INT,cycle_minutes NUMERIC,active_threads INT)
RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE WHEN people_ahead IS NULL OR active_threads<=0 OR active_threads IS NULL OR cycle_minutes IS NULL THEN NULL
    WHEN people_ahead<=0 OR cycle_minutes<=0 THEN 0
    ELSE GREATEST(1,ROUND((people_ahead*cycle_minutes/active_threads)/5)*5)::int END
$$;

CREATE OR REPLACE FUNCTION dorify.queue_estimation_needs_refresh(p_queue UUID,p_date DATE,p_now TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM dorify.dori_queue_estimation_stats stats
    JOIN dorify.dori_queue_estimation_revision rev USING(queue_id)
    WHERE stats.queue_id=p_queue AND stats.activity_date=p_date
      AND stats.input_revision>=rev.revision AND stats.calculated_at>=p_now-INTERVAL '15 minutes'
  )
$$;

CREATE OR REPLACE FUNCTION dorify.queue_refresh_estimation_stats(p_site UUID,p_queue UUID,p_date DATE,p_now TIMESTAMPTZ,p_force BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE event_name TEXT; new_event UUID;
BEGIN
  IF NOT p_force AND NOT dorify.queue_estimation_needs_refresh(p_queue,p_date,p_now) THEN RETURN FALSE; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('queue-estimation:'||p_queue::text,0)) THEN RETURN FALSE; END IF;
  INSERT INTO dorify.dori_queue_estimation_revision(queue_id) VALUES(p_queue) ON CONFLICT DO NOTHING;
  PERFORM revision FROM dorify.dori_queue_estimation_revision WHERE queue_id=p_queue FOR UPDATE;
  WITH ordered_calls AS (
           SELECT r.called_at,
             LEAD(r.called_at) OVER (
               PARTITION BY r.served_by_session_id, r.business_date
               ORDER BY r.called_at, r.registration_id
             ) AS next_called_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date
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
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date
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
           SELECT COALESCE(MIN(COALESCE(r.checked_in_at, r.called_at)), p_now) AS started_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date AND r.is_active = TRUE
         )
         INSERT INTO dorify.dori_queue_estimation_stats (
           site_id, queue_id, activity_date, window_started_at, window_ended_at,
           cycle_p50_minutes, cycle_p65_minutes, cycle_p90_minutes,
           wait_p50_minutes, wait_p65_minutes, wait_p90_minutes,
           sample_size, is_reliable, input_revision, calculated_at, created_at, updated_at
         )
         SELECT p_site, p_queue, p_date::date, b.started_at, p_now,
           c.p50, c.p65, c.p90, w.p50, w.p65, w.p90,
           c.sample_size, c.sample_size >= 30,
           (SELECT revision FROM dorify.dori_queue_estimation_revision WHERE queue_id=p_queue), p_now, p_now, p_now
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
           input_revision = EXCLUDED.input_revision,
           calculated_at = EXCLUDED.calculated_at,
           updated_at = EXCLUDED.updated_at;
  UPDATE dorify.dori_queue_estimation_revision SET calculated_revision=revision WHERE queue_id=p_queue;
  FOREACH event_name IN ARRAY ARRAY['queue_position_changed','queue_display_changed'] LOOP
    INSERT INTO dorify.dori_realtime_outbox(queue_id,event_type,payload,created_at,published_at)
      VALUES(p_queue,event_name,jsonb_build_object('queueId',p_queue,'reason','estimation_updated','timestamp',p_now),p_now,p_now)
      RETURNING event_id INTO new_event;
    INSERT INTO dorify.dori_realtime_topic_state(queue_id,event_type,version,event_id,updated_at)
      VALUES(p_queue,event_name,1,new_event,p_now)
      ON CONFLICT(queue_id,event_type) DO UPDATE SET version=dorify.dori_realtime_topic_state.version+1,event_id=EXCLUDED.event_id,updated_at=EXCLUDED.updated_at;
  END LOOP;
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION dorify.queue_wait_context(queue_ids UUID[],observed TIMESTAMPTZ,requested_date DATE DEFAULT NULL,refresh_stats BOOLEAN DEFAULT TRUE)
RETURNS TABLE(site_id UUID,queue_id UUID,business_date DATE,waiting_count INT,active_threads INT,estimated_wait_minutes INT,cycle_minutes NUMERIC,method TEXT,sample_size INT,is_reliable BOOLEAN,stats_calculated_at TIMESTAMPTZ,calculated_at TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
DECLARE context RECORD;
BEGIN
  IF refresh_stats THEN
    FOR context IN SELECT q.site_id,q.queue_id,COALESCE(requested_date,(observed AT TIME ZONE s.timezone)::date) AS activity_date
      FROM dorify.dori_queue q JOIN dorify.dori_site s USING(site_id) WHERE q.queue_id=ANY(queue_ids) ORDER BY q.queue_id
    LOOP
      PERFORM dorify.queue_refresh_estimation_stats(context.site_id,context.queue_id,context.activity_date,observed);
    END LOOP;
  END IF;
  RETURN QUERY WITH ranked AS MATERIALIZED (SELECT * FROM dorify.queue_operational_candidates(queue_ids,observed)),
    contexts AS (
      SELECT q.site_id,q.queue_id,COALESCE(requested_date,(observed AT TIME ZONE s.timezone)::date) AS activity_date,q.average_wait_time
      FROM dorify.dori_queue q JOIN dorify.dori_site s USING(site_id) WHERE q.queue_id=ANY(queue_ids)
    ), inputs AS (
      SELECT c.*, (SELECT COUNT(*)::int FROM ranked r WHERE r.queue_id=c.queue_id AND r.business_date=c.activity_date) AS waiting,
        (SELECT COUNT(*)::int FROM dorify.dori_operator_session os WHERE os.queue_id=c.queue_id AND os.disconnected_at IS NULL AND os.mode='active') AS threads,
        stat.activity_date AS stat_date,stat.cycle_p50_minutes,stat.sample_size,stat.is_reliable,stat.calculated_at
      FROM contexts c LEFT JOIN LATERAL (
        SELECT e.activity_date,e.cycle_p50_minutes,e.sample_size,e.is_reliable,e.calculated_at
        FROM dorify.dori_queue_estimation_stats e WHERE e.queue_id=c.queue_id AND e.site_id=c.site_id
          AND e.cycle_p50_minutes IS NOT NULL AND e.activity_date<=c.activity_date
        ORDER BY e.activity_date DESC,e.calculated_at DESC LIMIT 1
      ) stat ON TRUE
    )
    SELECT i.site_id,i.queue_id,i.activity_date,i.waiting,i.threads,
      dorify.queue_estimate_minutes(i.waiting,COALESCE(i.cycle_p50_minutes,i.average_wait_time),i.threads),
      COALESCE(i.cycle_p50_minutes,i.average_wait_time)::numeric,
      CASE WHEN i.threads=0 THEN 'unavailable' WHEN i.stat_date=i.activity_date THEN 'queue_daily_p50' WHEN i.stat_date IS NOT NULL THEN 'last_calculated' ELSE 'theoretical_queue' END,
      i.sample_size,COALESCE(i.threads>0 AND i.stat_date=i.activity_date AND i.is_reliable AND NOT dorify.queue_estimation_needs_refresh(i.queue_id,i.activity_date,observed),FALSE),i.calculated_at,observed FROM inputs i;
END $$;

CREATE OR REPLACE FUNCTION dorify.queue_ticket_estimates(queue_ids UUID[],observed TIMESTAMPTZ,refresh_stats BOOLEAN DEFAULT TRUE,registration_ids UUID[] DEFAULT NULL)
RETURNS TABLE(registration_id UUID,queue_id UUID,business_date DATE,"position" INT,estimated_wait_minutes INT,method TEXT,sample_size INT,is_reliable BOOLEAN,stats_calculated_at TIMESTAMPTZ,calculated_at TIMESTAMPTZ)
LANGUAGE SQL VOLATILE AS $$
  WITH dates AS (SELECT DISTINCT r.queue_id,r.business_date FROM dorify.dori_registration r WHERE r.queue_id=ANY(queue_ids) AND r.is_active AND r.status IN ('waiting','in_progress') AND (registration_ids IS NULL OR r.registration_id=ANY(registration_ids))),
  contexts AS MATERIALIZED (SELECT context.* FROM dates CROSS JOIN LATERAL dorify.queue_wait_context(ARRAY[dates.queue_id],observed,dates.business_date,refresh_stats) context),
  ranked AS MATERIALIZED (SELECT * FROM dorify.queue_operational_positions(queue_ids,observed))
  SELECT r.registration_id,r.queue_id,r.business_date,
    CASE WHEN r.status='in_progress' THEN 0 ELSE ranking."position" END,
    CASE WHEN r.status='in_progress' THEN 0 ELSE dorify.queue_estimate_minutes(ranking."position"-1,c.cycle_minutes,c.active_threads) END,
    CASE WHEN ranking."position" IS NULL AND r.status='waiting' THEN 'unavailable' ELSE c.method END,c.sample_size,COALESCE(ranking."position" IS NOT NULL AND c.is_reliable,FALSE),c.stats_calculated_at,observed
  FROM dorify.dori_registration r
  JOIN contexts c ON c.queue_id=r.queue_id AND c.business_date=r.business_date
  LEFT JOIN ranked ranking ON ranking.registration_id=r.registration_id
  WHERE r.queue_id=ANY(queue_ids) AND r.is_active AND r.status IN ('waiting','in_progress') AND (registration_ids IS NULL OR r.registration_id=ANY(registration_ids))
$$;

CREATE OR REPLACE FUNCTION dorify_agent.refresh_tracking(observed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE targets UUID[]; dirty UUID[]; changed UUID[]; full_targets UUID[]; affected INT; refresh_context RECORD;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('dorify:tracking-projection')) THEN RETURN 0; END IF;
  -- Refresh statistics before taking dirty-row locks (same lock order as API reads).
  FOR refresh_context IN SELECT DISTINCT r.queue_id,r.business_date FROM dorify.dori_registration r
    WHERE r.is_active AND r.status IN ('waiting','in_progress') AND r.registration_tracking_token_valid_until>observed
    ORDER BY r.queue_id,r.business_date LOOP
    PERFORM * FROM dorify.queue_wait_context(ARRAY[refresh_context.queue_id],observed,refresh_context.business_date);
  END LOOP;
  -- Lock claimed work until commit. Concurrent transactions enqueue after deletion,
  -- so even a long transaction with an old updated_at cannot be lost.
  SELECT array_agg(registration_id) INTO changed FROM (
    SELECT registration_id FROM dorify_agent.tracking_dirty_registration ORDER BY registration_id FOR UPDATE
  ) claimed;
  SELECT array_agg(queue_id) INTO dirty FROM (
    SELECT queue_id FROM dorify_agent.tracking_dirty_queue ORDER BY queue_id FOR UPDATE
  ) claimed;
  SELECT array_agg(q.queue_id) INTO full_targets
  FROM dorify.dori_queue q LEFT JOIN dorify_agent.tracking_checkpoint c USING(queue_id)
  LEFT JOIN dorify_agent.tracking_dirty_queue d USING(queue_id)
  WHERE c.queue_id IS NULL OR c.full_refreshed_at<observed-INTERVAL '15 minutes' OR d.full_refresh;
  SELECT array_agg(DISTINCT queue_id) INTO targets FROM (
    SELECT unnest(dirty) AS queue_id UNION SELECT unnest(full_targets)
    UNION SELECT queue_id FROM dorify.dori_registration
      WHERE is_active AND status IN ('waiting','in_progress')
        AND registration_tracking_token_valid_until>observed
  ) queues;
  IF targets IS NULL THEN RETURN 0; END IF;
  WITH candidates AS MATERIALIZED (
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.queue_id=ANY(targets) AND r.is_active AND r.status IN ('waiting','in_progress')
        AND r.registration_tracking_token_valid_until>observed
    UNION
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.registration_id=ANY(changed)
    UNION
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.queue_id=ANY(full_targets) AND r.registration_tracking_token_valid_until>observed
  ), estimates AS MATERIALIZED (
    SELECT * FROM dorify.queue_ticket_estimates(targets,observed,FALSE,ARRAY(SELECT candidate.registration_id FROM candidates candidate))
  ), incoming AS (
    SELECT encode(sha256(convert_to(r.registration_tracking_token::text,'UTF8')),'hex') AS token_hash,
      r.registration_id,r.ticket_number,r.status,q.queue_name,os.counter_name,
      CASE WHEN r.is_active THEN r.registration_tracking_token_valid_until
        ELSE LEAST(r.registration_tracking_token_valid_until,observed) END AS expires_at,
      e."position",e.estimated_wait_minutes AS estimated_wait
    FROM candidates candidate
    JOIN dorify.dori_registration r ON r.registration_id=candidate.registration_id
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    LEFT JOIN estimates e ON e.registration_id=r.registration_id
    LEFT JOIN dorify.dori_operator_session os ON os.session_id=r.served_by_session_id
  )
  INSERT INTO dorify.dori_public_tracking_state
    (tracking_token_hash,registration_id,sequence,cloud_synced_sequence,ticket_number,
     registration_status,"position",estimated_wait_minutes,counter_name,queue_public_name,
     observed_at,expires_at,updated_at)
  SELECT token_hash,registration_id,1,0,ticket_number,status,"position",estimated_wait,
    counter_name,queue_name,observed,expires_at,observed FROM incoming
  ON CONFLICT(tracking_token_hash) DO UPDATE SET
    sequence=dorify.dori_public_tracking_state.sequence+1,ticket_number=EXCLUDED.ticket_number,
    registration_status=EXCLUDED.registration_status,"position"=EXCLUDED."position",
    estimated_wait_minutes=EXCLUDED.estimated_wait_minutes,counter_name=EXCLUDED.counter_name,
    queue_public_name=EXCLUDED.queue_public_name,observed_at=EXCLUDED.observed_at,
    expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at
  WHERE (dorify.dori_public_tracking_state.ticket_number,dorify.dori_public_tracking_state.registration_status,
    dorify.dori_public_tracking_state."position",dorify.dori_public_tracking_state.estimated_wait_minutes,
    dorify.dori_public_tracking_state.counter_name,dorify.dori_public_tracking_state.queue_public_name,
    dorify.dori_public_tracking_state.expires_at)
  IS DISTINCT FROM (EXCLUDED.ticket_number,EXCLUDED.registration_status,EXCLUDED."position",
    EXCLUDED.estimated_wait_minutes,EXCLUDED.counter_name,EXCLUDED.queue_public_name,EXCLUDED.expires_at);
  GET DIAGNOSTICS affected=ROW_COUNT;
  DELETE FROM dorify_agent.tracking_dirty_registration WHERE registration_id=ANY(changed);
  DELETE FROM dorify_agent.tracking_dirty_queue WHERE queue_id=ANY(dirty);
  INSERT INTO dorify_agent.tracking_checkpoint(queue_id,full_refreshed_at)
    SELECT unnest(full_targets),observed
    ON CONFLICT(queue_id) DO UPDATE SET full_refreshed_at=EXCLUDED.full_refreshed_at;
  RETURN affected;
END $$;

-- Changes to inherited priorities also invalidate the projections of every affected queue.
CREATE OR REPLACE FUNCTION dorify_agent.mark_site_tracking_dirty() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id,full_refresh)
    SELECT q.queue_id,TRUE FROM dorify.dori_queue q WHERE q.site_id=NEW.site_id ORDER BY q.queue_id
    ON CONFLICT(queue_id) DO UPDATE SET full_refresh=TRUE,updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tracking_site_priority_update ON dorify.dori_site;
CREATE TRIGGER tracking_site_priority_update AFTER UPDATE OF default_base_weight_walkin,default_base_weight_appointment,
  default_escalation_rate_walkin,default_escalation_rate_appointment,timezone ON dorify.dori_site
FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_site_tracking_dirty();
