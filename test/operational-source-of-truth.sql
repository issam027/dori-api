-- Run inside a transaction and ROLLBACK afterwards. No notification is committed.
-- Clones only fixture structure from existing local seed rows; no personal data is printed.
CREATE TEMP TABLE operational_rules_fixture (data JSONB) ON COMMIT DROP;
DO $$
DECLARE
  template_queue UUID; test_queue UUID := gen_random_uuid(); test_site UUID;
  test_date DATE := DATE '2030-04-15'; observed TIMESTAMPTZ := TIMESTAMPTZ '2030-04-15 10:00:00+00';
  people UUID[]; tickets UUID[] := ARRAY[]::UUID[]; sessions UUID[] := ARRAY[]::UUID[];
  session_users UUID[] := ARRAY[]::UUID[]; candidate RECORD; context RECORD; estimate RECORD;
  new_id UUID; index INT; expected UUID[]; actual UUID[];
BEGIN
  SELECT q.queue_id,q.site_id INTO template_queue,test_site FROM dorify.dori_queue q
    WHERE q.is_active AND q.deleted_at IS NULL
      AND EXISTS(SELECT 1 FROM dorify.dori_site s WHERE s.site_id=q.site_id AND s.is_active AND s.deleted_at IS NULL)
      AND EXISTS(SELECT 1 FROM dorify.dori_registration r WHERE r.queue_id=q.queue_id)
      AND (SELECT COUNT(*) FROM dorify.dori_person p WHERE p.site_id=q.site_id)>=6 LIMIT 1;
  IF template_queue IS NULL THEN RAISE EXCEPTION 'Seed queue with six people required'; END IF;
  INSERT INTO dorify.dori_queue
    SELECT (jsonb_populate_record(NULL::dorify.dori_queue,to_jsonb(q)||jsonb_build_object(
      'queue_id',test_queue,'queue_code','T-'||left(test_queue::text,8),'queue_name','Operational rules fixture',
      'thread_count',2,'average_wait_time',10,'base_weight_walkin',0,'base_weight_appointment',60,
      'escalation_rate_walkin',1,'escalation_rate_appointment',1))).*
    FROM dorify.dori_queue q WHERE q.queue_id=template_queue;
  INSERT INTO dorify.dori_queue_service_tier
    SELECT (jsonb_populate_record(NULL::dorify.dori_queue_service_tier,to_jsonb(t)||jsonb_build_object('queue_id',test_queue))).*
    FROM dorify.dori_queue_service_tier t WHERE t.queue_id=template_queue;
  SELECT array_agg(person_id) INTO people FROM (SELECT person_id FROM dorify.dori_person WHERE site_id=test_site ORDER BY person_id LIMIT 6) p;
  FOR index IN 1..6 LOOP
    new_id:=gen_random_uuid(); tickets:=array_append(tickets,new_id);
    INSERT INTO dorify.dori_registration
      SELECT (jsonb_populate_record(NULL::dorify.dori_registration,to_jsonb(r)||jsonb_build_object(
        'registration_id',new_id,'queue_id',test_queue,'person_id',people[index],
        'business_date',test_date,'ticket_number','TEST-'||index,'registration_tracking_token',gen_random_uuid(),
        'registration_tracking_token_valid_until',observed+INTERVAL '1 day','is_active',TRUE,'deleted_at',NULL,
        'entry_type',CASE WHEN index<3 THEN 'walkin' ELSE 'appointment' END,
        'scheduled_time',CASE WHEN index<3 THEN NULL WHEN index=3 THEN observed-INTERVAL '15 minutes'
          WHEN index=4 THEN observed+INTERVAL '1 hour' ELSE observed+INTERVAL '30 minutes' END,
        'appointment_status',CASE WHEN index<3 THEN 'n/a' WHEN index=6 THEN 'booked' ELSE 'checked_in' END,
        'status',CASE WHEN index=6 THEN 'booked' ELSE 'waiting' END,
        'checked_in_at',CASE WHEN index=6 THEN NULL ELSE observed-INTERVAL '1 hour' END,
        'priority_reference_time',CASE WHEN index=1 THEN observed-INTERVAL '1 hour' WHEN index=2 THEN observed-INTERVAL '30 minutes' ELSE observed-INTERVAL '15 minutes' END,
        'called_at',NULL,'served_at',NULL,'closed_at',NULL,'served_by_session_id',NULL,'served_by_user_id',NULL,
        'carried_over_from_date',NULL))).*
      FROM dorify.dori_registration r WHERE r.queue_id=template_queue LIMIT 1;
  END LOOP;
  index:=0;
  FOR candidate IN SELECT DISTINCT ON(user_id) * FROM dorify.dori_operator_session ORDER BY user_id LIMIT 2 LOOP
    index:=index+1; new_id:=gen_random_uuid(); sessions:=array_append(sessions,new_id); session_users:=array_append(session_users,candidate.user_id);
    INSERT INTO dorify.dori_operator_session
      SELECT (jsonb_populate_record(NULL::dorify.dori_operator_session,to_jsonb(candidate)||jsonb_build_object(
        'session_id',new_id,'queue_id',test_queue,'thread_number',index,'mode','active',
        'connected_at',observed-INTERVAL '2 hours','last_seen_at',observed,
        'disconnected_at',NULL,'closure_reason',NULL,'closed_by_user_id',NULL))).*;
  END LOOP;
  IF index<>2 THEN RAISE EXCEPTION 'Two seed operators required'; END IF;

  SELECT array_agg(registration_id ORDER BY position) INTO actual FROM dorify.queue_operational_positions(ARRAY[test_queue],observed);
  expected:=ARRAY[tickets[3],tickets[1],tickets[2],tickets[5],tickets[4]];
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Priority or future appointment ordering mismatch'; END IF;
  SELECT * INTO context FROM dorify.queue_wait_context(ARRAY[test_queue],observed,test_date);
  IF context.waiting_count<>5 OR context.active_threads<>2 OR context.estimated_wait_minutes<>25 OR context.method<>'theoretical_queue' THEN
    RAISE EXCEPTION 'Queue context mismatch: %',row_to_json(context); END IF;
  FOR estimate IN SELECT * FROM dorify.queue_ticket_estimates(ARRAY[test_queue],observed) LOOP
    IF estimate.estimated_wait_minutes IS DISTINCT FROM dorify.queue_estimate_minutes(estimate.position-1,10,2) THEN
      RAISE EXCEPTION 'Ticket formula differs from queue formula'; END IF;
  END LOOP;
  IF dorify.queue_estimate_minutes(1,1,2)<>1 OR dorify.queue_estimate_minutes(1,5,2)<>5
    OR dorify.queue_estimate_minutes(0,10,2)<>0 OR dorify.queue_estimate_minutes(3,10,0) IS NOT NULL THEN
    RAISE EXCEPTION 'Rounding, first position or no-counter rule mismatch'; END IF;
  IF (SELECT COUNT(*) FROM dorify.queue_ticket_estimates(ARRAY[test_queue],observed,TRUE,ARRAY[tickets[3]]))<>1 THEN
    RAISE EXCEPTION 'Batch estimate did not restrict itself to requested tickets'; END IF;

  INSERT INTO dorify.dori_queue_estimation_stats
    SELECT (jsonb_populate_record(NULL::dorify.dori_queue_estimation_stats,to_jsonb(e)||jsonb_build_object(
      'estimation_stats_id',gen_random_uuid(),'activity_date',test_date-1,'cycle_p50_minutes',7,'cycle_p65_minutes',7,'cycle_p90_minutes',7,
      'sample_size',40,'is_reliable',TRUE,'calculated_at',observed-INTERVAL '1 day'))).*
    FROM dorify.dori_queue_estimation_stats e WHERE e.queue_id=test_queue AND e.activity_date=test_date;
  SELECT * INTO context FROM dorify.queue_wait_context(ARRAY[test_queue],observed,test_date);
  IF context.method<>'last_calculated' OR context.estimated_wait_minutes<>20 OR context.is_reliable THEN
    RAISE EXCEPTION 'Last known P50 fallback mismatch'; END IF;
  INSERT INTO dorify.dori_queue_estimation_stats
    SELECT (jsonb_populate_record(NULL::dorify.dori_queue_estimation_stats,to_jsonb(e)||jsonb_build_object(
      'estimation_stats_id',gen_random_uuid(),'activity_date',test_date+1,'cycle_p50_minutes',99,'cycle_p65_minutes',99,'cycle_p90_minutes',99))).*
    FROM dorify.dori_queue_estimation_stats e WHERE e.queue_id=test_queue AND e.activity_date=test_date;
  SELECT * INTO context FROM dorify.queue_wait_context(ARRAY[test_queue],observed,test_date);
  IF context.cycle_minutes<>7 THEN RAISE EXCEPTION 'Future statistics leaked into an earlier estimate'; END IF;

  UPDATE dorify.dori_registration SET priority_reference_time=observed-INTERVAL '1 hour' WHERE registration_id=tickets[2];
  SELECT registration_id INTO new_id FROM dorify.queue_operational_positions(ARRAY[test_queue],observed) WHERE position=2;
  IF new_id<>LEAST(tickets[1],tickets[2]) THEN RAISE EXCEPTION 'Unstable tie break'; END IF;

  -- Real changes invalidate P50 inputs; the next canonical read refreshes them.
  UPDATE dorify.dori_registration SET status='served',checked_in_at=observed-INTERVAL '2 hours',
    called_at=observed-INTERVAL '1 hour'+CASE WHEN registration_id=tickets[1] THEN INTERVAL '0 minutes' ELSE INTERVAL '12 minutes' END,
    served_at=observed-INTERVAL '30 minutes',closed_at=observed-INTERVAL '30 minutes',
    served_by_session_id=sessions[1],served_by_user_id=session_users[1]
    WHERE registration_id=ANY(ARRAY[tickets[1],tickets[2]]);
  SELECT * INTO context FROM dorify.queue_wait_context(ARRAY[test_queue],observed,test_date);
  IF context.cycle_minutes<>12 OR context.estimated_wait_minutes<>20 OR context.method<>'queue_daily_p50' OR context.is_reliable THEN
    RAISE EXCEPTION 'P50 refresh or low-sample reliability mismatch: %',row_to_json(context); END IF;

  UPDATE dorify.dori_operator_session SET disconnected_at=observed WHERE session_id=ANY(sessions);
  SELECT * INTO context FROM dorify.queue_wait_context(ARRAY[test_queue],observed,test_date);
  IF context.estimated_wait_minutes IS NOT NULL OR context.is_reliable OR context.method<>'unavailable' THEN
    RAISE EXCEPTION 'No active counter must produce an unavailable estimate'; END IF;
  IF EXISTS(SELECT 1 FROM dorify.queue_ticket_estimates(ARRAY[test_queue],observed) WHERE estimated_wait_minutes IS NOT NULL) THEN
    RAISE EXCEPTION 'Ticket estimates ignored absence of active counters'; END IF;
  INSERT INTO operational_rules_fixture(data) VALUES(jsonb_build_object(
    'queueId',test_queue,'siteId',test_site,'date',test_date,'now',observed,
    'tickets',tickets,'sessions',sessions,'users',session_users));
  RAISE NOTICE 'Operational source of truth: priority, early appointments, ties, queue/ticket estimates, rounding, P50 freshness, reliability and no-counter cases passed';
END $$;
