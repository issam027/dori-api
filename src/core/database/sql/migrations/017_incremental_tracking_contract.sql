-- Contract v1 shared by the engine and outbound agent: a single operational ranking.
CREATE OR REPLACE FUNCTION dorify.queue_operational_positions(queue_ids UUID[], observed TIMESTAMPTZ)
RETURNS TABLE(registration_id UUID, queue_id UUID, business_date DATE, "position" INT)
LANGUAGE SQL STABLE AS $$
  SELECT r.registration_id, r.queue_id, r.business_date,
    ROW_NUMBER() OVER (PARTITION BY r.queue_id, r.business_date ORDER BY
      CASE WHEN r.entry_type='walkin'
        OR (r.appointment_status='checked_in' AND r.scheduled_time<=observed) THEN 0 ELSE 1 END,
      CASE WHEN r.entry_type='walkin' OR r.scheduled_time<=observed THEN
        ROUND((CASE WHEN r.entry_type='appointment'
          THEN COALESCE(q.base_weight_appointment,s.default_base_weight_appointment,60)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60
              * COALESCE(q.escalation_rate_appointment,s.default_escalation_rate_appointment,1)
          ELSE COALESCE(q.base_weight_walkin,s.default_base_weight_walkin,0)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60
              * COALESCE(q.escalation_rate_walkin,s.default_escalation_rate_walkin,1)
          END)::numeric,2) END DESC NULLS LAST,
      CASE WHEN r.entry_type='walkin' OR r.scheduled_time<=observed
        THEN r.priority_reference_time ELSE r.scheduled_time END,
      r.registration_id
    )::int
  FROM dorify.dori_registration r
  JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
  JOIN dorify.dori_site s ON s.site_id=q.site_id
  WHERE r.queue_id=ANY(queue_ids) AND r.status='waiting' AND r.is_active
    AND (r.entry_type='walkin' OR r.appointment_status='checked_in')
$$;

CREATE TABLE IF NOT EXISTS dorify_agent.tracking_dirty_queue (
  queue_id UUID PRIMARY KEY REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE,
  full_refresh BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dorify_agent.tracking_dirty_registration (
  registration_id UUID PRIMARY KEY REFERENCES dorify.dori_registration(registration_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS dorify_agent.tracking_checkpoint (
  queue_id UUID PRIMARY KEY REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE,
  full_refreshed_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION dorify_agent.mark_registration_tracking_dirty() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Transition tables keep a bulk registration update to one invalidation per file.
  INSERT INTO dorify_agent.tracking_dirty_registration(registration_id)
    SELECT registration_id FROM new_rows ON CONFLICT DO NOTHING;
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id)
    SELECT DISTINCT queue_id FROM new_rows
    ON CONFLICT(queue_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tracking_registration_insert ON dorify.dori_registration;
CREATE TRIGGER tracking_registration_insert AFTER INSERT ON dorify.dori_registration
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION dorify_agent.mark_registration_tracking_dirty();
DROP TRIGGER IF EXISTS tracking_registration_update ON dorify.dori_registration;
CREATE TRIGGER tracking_registration_update AFTER UPDATE ON dorify.dori_registration
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION dorify_agent.mark_registration_tracking_dirty();

CREATE OR REPLACE FUNCTION dorify_agent.mark_queue_tracking_dirty() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE target UUID;
BEGIN
  IF TG_OP='DELETE' THEN target=OLD.queue_id; ELSE target=NEW.queue_id; END IF;
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id,full_refresh)
    SELECT target, TG_TABLE_NAME='dori_queue'
    WHERE EXISTS(SELECT 1 FROM dorify.dori_queue WHERE queue_id=target)
    ON CONFLICT(queue_id) DO UPDATE SET
      full_refresh=dorify_agent.tracking_dirty_queue.full_refresh OR EXCLUDED.full_refresh,
      updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tracking_queue_update ON dorify.dori_queue;
CREATE TRIGGER tracking_queue_update AFTER UPDATE ON dorify.dori_queue
FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();
DROP TRIGGER IF EXISTS tracking_session_change ON dorify.dori_operator_session;
CREATE TRIGGER tracking_session_change AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_operator_session
FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();
DROP TRIGGER IF EXISTS tracking_stats_change ON dorify.dori_queue_estimation_stats;
CREATE TRIGGER tracking_stats_change AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_queue_estimation_stats
FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();

INSERT INTO dorify_agent.tracking_dirty_queue(queue_id,full_refresh)
SELECT queue_id,TRUE FROM dorify.dori_queue ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION dorify_agent.refresh_tracking(observed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE targets UUID[]; dirty UUID[]; changed UUID[]; full_targets UUID[]; affected INT;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('dorify:tracking-projection')) THEN RETURN 0; END IF;
  -- Lock claimed work until commit. Concurrent transactions enqueue after deletion,
  -- so even a long transaction with an old updated_at cannot be lost.
  SELECT array_agg(queue_id) INTO dirty FROM (
    SELECT queue_id FROM dorify_agent.tracking_dirty_queue FOR UPDATE
  ) claimed;
  SELECT array_agg(registration_id) INTO changed FROM (
    SELECT registration_id FROM dorify_agent.tracking_dirty_registration FOR UPDATE
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
  ), positions AS MATERIALIZED (
    SELECT * FROM dorify.queue_operational_positions(targets,observed)
  ), threads AS (
    SELECT queue_id, COUNT(*) AS active FROM dorify.dori_operator_session
    WHERE queue_id=ANY(targets) AND disconnected_at IS NULL AND mode='active' GROUP BY queue_id
  ), statistics AS MATERIALIZED (
    SELECT context.queue_id,context.business_date,stat.cycle_p50_minutes
    FROM (
      SELECT DISTINCT r.queue_id,r.business_date FROM candidates candidate
      JOIN dorify.dori_registration r ON r.registration_id=candidate.registration_id
      WHERE r.status='waiting'
    ) context JOIN dorify.dori_queue q ON q.queue_id=context.queue_id
    LEFT JOIN LATERAL (
      SELECT cycle_p50_minutes FROM dorify.dori_queue_estimation_stats stats
      WHERE stats.site_id=q.site_id AND stats.queue_id=q.queue_id AND cycle_p50_minutes IS NOT NULL
      ORDER BY (activity_date=context.business_date) DESC,calculated_at DESC LIMIT 1
    ) stat ON TRUE
  ), incoming AS (
    SELECT encode(sha256(convert_to(r.registration_tracking_token::text,'UTF8')),'hex') AS token_hash,
      r.registration_id,r.ticket_number,r.status,q.queue_name,os.counter_name,
      CASE WHEN r.is_active THEN r.registration_tracking_token_valid_until
        ELSE LEAST(r.registration_tracking_token_valid_until,observed) END AS expires_at,
      CASE WHEN r.status='in_progress' THEN 0 ELSE p.position END AS position,
      CASE WHEN r.status='in_progress' THEN 0
        WHEN p.position IS NULL OR COALESCE(t.active,0)=0 THEN NULL
        WHEN p.position<=1 THEN 0
        ELSE GREATEST(1,ROUND(((p.position-1)*COALESCE(stat.cycle_p50_minutes,q.average_wait_time)::numeric/t.active)/5)*5)::int
      END AS estimated_wait
    FROM candidates candidate
    JOIN dorify.dori_registration r ON r.registration_id=candidate.registration_id
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    LEFT JOIN positions p ON p.registration_id=r.registration_id
    LEFT JOIN threads t ON t.queue_id=r.queue_id
    LEFT JOIN dorify.dori_operator_session os ON os.session_id=r.served_by_session_id
    LEFT JOIN statistics stat ON stat.queue_id=r.queue_id AND stat.business_date=r.business_date
  )
  INSERT INTO dorify.dori_public_tracking_state
    (tracking_token_hash,registration_id,sequence,cloud_synced_sequence,ticket_number,
     registration_status,position,estimated_wait_minutes,counter_name,queue_public_name,
     observed_at,expires_at,updated_at)
  SELECT token_hash,registration_id,1,0,ticket_number,status,position,estimated_wait,
    counter_name,queue_name,observed,expires_at,observed FROM incoming
  ON CONFLICT(tracking_token_hash) DO UPDATE SET
    sequence=dorify.dori_public_tracking_state.sequence+1,ticket_number=EXCLUDED.ticket_number,
    registration_status=EXCLUDED.registration_status,position=EXCLUDED.position,
    estimated_wait_minutes=EXCLUDED.estimated_wait_minutes,counter_name=EXCLUDED.counter_name,
    queue_public_name=EXCLUDED.queue_public_name,observed_at=EXCLUDED.observed_at,
    expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at
  WHERE (dorify.dori_public_tracking_state.ticket_number,dorify.dori_public_tracking_state.registration_status,
    dorify.dori_public_tracking_state.position,dorify.dori_public_tracking_state.estimated_wait_minutes,
    dorify.dori_public_tracking_state.counter_name,dorify.dori_public_tracking_state.queue_public_name,
    dorify.dori_public_tracking_state.expires_at)
  IS DISTINCT FROM (EXCLUDED.ticket_number,EXCLUDED.registration_status,EXCLUDED.position,
    EXCLUDED.estimated_wait_minutes,EXCLUDED.counter_name,EXCLUDED.queue_public_name,EXCLUDED.expires_at);
  GET DIAGNOSTICS affected=ROW_COUNT;
  DELETE FROM dorify_agent.tracking_dirty_registration WHERE registration_id=ANY(changed);
  DELETE FROM dorify_agent.tracking_dirty_queue WHERE queue_id=ANY(dirty);
  INSERT INTO dorify_agent.tracking_checkpoint(queue_id,full_refreshed_at)
    SELECT unnest(full_targets),observed
    ON CONFLICT(queue_id) DO UPDATE SET full_refreshed_at=EXCLUDED.full_refreshed_at;
  RETURN affected;
END $$;

ALTER TABLE dorify_agent.command_inbox ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
ALTER TABLE dorify_agent.command_inbox ALTER COLUMN lease_until
  SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 minutes');
UPDATE dorify_agent.command_inbox SET lease_until=received_at WHERE status='RUNNING' AND lease_until IS NULL;

