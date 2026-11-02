-- Prepare statistics without calculating/discarding queue counts before the canonical ticket snapshot.
-- Preserve the lock order established by migration 020.
CREATE OR REPLACE FUNCTION dorify_agent.refresh_tracking(observed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE targets UUID[]; dirty UUID[]; changed UUID[]; full_targets UUID[]; affected INT; refresh_context RECORD;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('dorify:tracking-projection')) THEN RETURN 0; END IF;
  -- Refresh statistics before taking dirty-row locks (same lock order as API reads).
  FOR refresh_context IN SELECT DISTINCT q.site_id,r.queue_id,r.business_date FROM dorify.dori_registration r JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    WHERE r.is_active AND r.status IN ('waiting','in_progress') AND r.registration_tracking_token_valid_until>observed
    ORDER BY r.queue_id,r.business_date,q.site_id LOOP
    PERFORM dorify.queue_refresh_estimation_stats(refresh_context.site_id,refresh_context.queue_id,refresh_context.business_date,observed);
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

