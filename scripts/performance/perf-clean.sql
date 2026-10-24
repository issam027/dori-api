-- PERF-01 targeted cleanup. It never deletes reference data or unrelated sites.
BEGIN;
SET LOCAL search_path TO dorify, pg_catalog;

CREATE TEMP TABLE perf_sites ON COMMIT DROP AS
SELECT site_id FROM dorify.dori_site
WHERE site_name LIKE 'PERF-01 - %';

CREATE TEMP TABLE perf_queues ON COMMIT DROP AS
SELECT queue_id FROM dorify.dori_queue
WHERE site_id IN (SELECT site_id FROM perf_sites);

CREATE TEMP TABLE perf_registrations ON COMMIT DROP AS
SELECT registration_id FROM dorify.dori_registration
WHERE queue_id IN (SELECT queue_id FROM perf_queues);

CREATE TEMP TABLE perf_users ON COMMIT DROP AS
SELECT user_id FROM dorify.dori_user
WHERE username LIKE 'perf01_%';

-- Performance calls can create append-only audit rows referencing PERF-01 users/sites.
-- The trigger is disabled only inside this transaction and only matching rows are removed.
ALTER TABLE dorify.dori_audit_event DISABLE TRIGGER trg_audit_event_append_only;
DELETE FROM dorify.dori_audit_event
WHERE site_scope_id IN (SELECT site_id FROM perf_sites)
   OR actor_user_id IN (SELECT user_id FROM perf_users);
ALTER TABLE dorify.dori_audit_event ENABLE TRIGGER trg_audit_event_append_only;

DELETE FROM dorify.dori_notification
WHERE registration_id IN (SELECT registration_id FROM perf_registrations);
DELETE FROM dorify.dori_registration
WHERE registration_id IN (SELECT registration_id FROM perf_registrations);
DELETE FROM dorify.dori_queue_estimation_stats
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_queue_daily_reset_execution
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_queue_daily_ticket_counter
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_operator_session
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_queue_tier_notification_rule
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_queue_service_tier
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_user_queue_assignment
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_person_note
WHERE person_id IN (
  SELECT person_id FROM dorify.dori_person
  WHERE site_id IN (SELECT site_id FROM perf_sites)
);
DELETE FROM dorify.dori_person
WHERE site_id IN (SELECT site_id FROM perf_sites);
DELETE FROM dorify.dori_queue
WHERE queue_id IN (SELECT queue_id FROM perf_queues);
DELETE FROM dorify.dori_user_site_assignment
WHERE site_id IN (SELECT site_id FROM perf_sites)
   OR user_id IN (SELECT user_id FROM perf_users);
DELETE FROM dorify.dori_site
WHERE site_id IN (SELECT site_id FROM perf_sites);
DELETE FROM dorify.dori_user_session
WHERE user_id IN (SELECT user_id FROM perf_users);
DELETE FROM dorify.dori_user_role
WHERE user_id IN (SELECT user_id FROM perf_users);
DELETE FROM dorify.dori_user
WHERE user_id IN (SELECT user_id FROM perf_users);

COMMIT;
