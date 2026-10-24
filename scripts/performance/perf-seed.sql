-- PERF-01 rolling volumetric dataset.
-- Every business date is derived from CURRENT_DATE so refresh stays useful over time.
-- Run perf-clean.sql before replaying, or use: npm run perf:seed:refresh
BEGIN;
SET LOCAL search_path TO dorify, pg_catalog;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM dorify.dori_site
    WHERE site_name LIKE 'PERF-01 - %'
  ) OR EXISTS (
    SELECT 1 FROM dorify.dori_user WHERE username LIKE 'perf01_%'
  ) THEN
    RAISE EXCEPTION 'PERF-01 dataset already exists. Run npm run perf:seed:refresh.';
  END IF;

  IF (SELECT COUNT(*) FROM dorify.dori_role
      WHERE role_name IN ('manager', 'operator', 'kiosk')) <> 3
     OR (SELECT COUNT(*) FROM dorify.dori_service_tier
         WHERE tier_code IN ('free', 'standard', 'premium')) <> 3 THEN
    RAISE EXCEPTION 'Reference seed is missing. Run npm run db:seed first.';
  END IF;
END $$;

-- Stable identities make API performance scenarios easy to discover.
INSERT INTO dorify.dori_user (
  username, email, password_hash, user_type, language_preference,
  must_change_password
) VALUES
  ('perf01_manager', 'manager.perf01@example.test', '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'human', 'fr', TRUE),
  ('perf01_operator_1', 'operator1.perf01@example.test', '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'human', 'fr', TRUE),
  ('perf01_operator_2', 'operator2.perf01@example.test', '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'human', 'fr', TRUE),
  ('perf01_operator_3', 'operator3.perf01@example.test', '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'human', 'fr', TRUE),
  ('perf01_operator_4', 'operator4.perf01@example.test', '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'human', 'fr', TRUE),
  ('perf01_kiosk', NULL, '$2b$10$xr3lEftD6JtHCny0g/ZK0.RAlenGn.N2yLHIhUmpdsJpWB4XpXoBS', 'kiosk', 'fr', TRUE);

INSERT INTO dorify.dori_user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM dorify.dori_user u
JOIN dorify.dori_role r ON r.role_name = CASE
  WHEN u.username = 'perf01_manager' THEN 'manager'
  WHEN u.username = 'perf01_kiosk' THEN 'kiosk'
  ELSE 'operator'
END
WHERE u.username LIKE 'perf01_%';
DO $$ BEGIN RAISE NOTICE 'stage=users'; END $$;

INSERT INTO dorify.dori_site (
  site_name, site_location, site_type, timezone, default_currency,
  default_appointments_enabled, default_appointment_slot_duration,
  default_slot_capacity, default_working_hours_start,
  default_working_hours_end, default_break_start, default_break_end,
  default_late_tolerance_minutes, default_locale,
  created_by_user_id, updated_by_user_id
)
SELECT v.name, v.location, v.site_type, 'Africa/Tunis', 'TND', TRUE, 15, 8,
       v.opens_at, v.closes_at, v.break_start, v.break_end, 20, 'fr',
       manager.user_id, manager.user_id
FROM dorify.dori_user manager
CROSS JOIN (VALUES
  ('PERF-01 - Mairie de Tunis', 'Avenue de Carthage, Tunis', 'public', TIME '08:00', TIME '16:30', TIME '12:30', TIME '13:30'),
  ('PERF-01 - Hopital de Tunis', 'Bab Saadoun, Tunis', 'public', TIME '07:00', TIME '20:00', TIME '12:30', TIME '13:00'),
  ('PERF-01 - Cabinet medical Tunis', 'El Menzah, Tunis', 'private', TIME '08:00', TIME '19:00', TIME '13:00', TIME '14:00'),
  ('PERF-01 - Restaurant a emporter Tunis', 'Lac 2, Tunis', 'private', TIME '10:00', TIME '23:00', TIME '15:00', TIME '16:00')
) v(name, location, site_type, opens_at, closes_at, break_start, break_end)
WHERE manager.username = 'perf01_manager';

INSERT INTO dorify.dori_user_site_assignment (
  user_id, site_id, assigned_by_user_id
)
SELECT u.user_id, s.site_id, manager.user_id
FROM dorify.dori_user u
CROSS JOIN dorify.dori_site s
CROSS JOIN dorify.dori_user manager
WHERE u.username LIKE 'perf01_%'
  AND s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager';
DO $$ BEGIN RAISE NOTICE 'stage=structure'; END $$;

INSERT INTO dorify.dori_queue (
  queue_code, site_id, queue_name, average_wait_time, thread_count,
  appointments_enabled, appointment_slot_duration, slot_capacity,
  working_hours_start, working_hours_end, break_start, break_end,
  locale, currency, created_by_user_id, updated_by_user_id
)
SELECT v.code, s.site_id, v.name, v.wait_minutes, 4, TRUE, 15, 8,
       '07:00', '20:00', '12:30', '13:00', 'fr', 'TND', manager.user_id,
       manager.user_id
FROM dorify.dori_site s
CROSS JOIN dorify.dori_user manager
CROSS JOIN (VALUES
  ('PF01', 'PERF-01 Accueil', 8),
  ('PF02', 'PERF-01 Dossiers', 12),
  ('PF03', 'PERF-01 Expertise', 18),
  ('PF04', 'PERF-01 Retraits', 6)
) v(code, name, wait_minutes)
WHERE s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager';

INSERT INTO dorify.dori_user_queue_assignment (
  user_id, queue_id, assigned_by_user_id
)
SELECT operator.user_id, q.queue_id, manager.user_id
FROM dorify.dori_queue q
JOIN dorify.dori_site s ON s.site_id = q.site_id
JOIN dorify.dori_user operator ON operator.username =
  'perf01_operator_' || RIGHT(q.queue_code, 1)
CROSS JOIN dorify.dori_user manager
WHERE s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager';

INSERT INTO dorify.dori_queue_service_tier (
  queue_id, tier_id, price, currency, display_order, is_default,
  created_by_user_id, updated_by_user_id
)
SELECT q.queue_id, tier.tier_id,
       CASE tier.tier_code WHEN 'free' THEN 0 WHEN 'standard' THEN 12 ELSE 25 END,
       'EUR', CASE tier.tier_code WHEN 'free' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,
       tier.tier_code = 'free', manager.user_id, manager.user_id
FROM dorify.dori_queue q
JOIN dorify.dori_site s ON s.site_id = q.site_id
CROSS JOIN dorify.dori_service_tier tier
CROSS JOIN dorify.dori_user manager
WHERE s.site_name LIKE 'PERF-01 - %'
  AND tier.tier_code IN ('free', 'standard', 'premium')
  AND manager.username = 'perf01_manager';

INSERT INTO dorify.dori_queue_tier_notification_rule (
  queue_id, tier_id, notification_type, channel, threshold_position,
  threshold_minutes, include_tracking_link, created_by_user_id,
  updated_by_user_id
)
SELECT qt.queue_id, qt.tier_id, v.kind, v.channel, v.position, v.minutes,
       TRUE, manager.user_id, manager.user_id
FROM dorify.dori_queue_service_tier qt
JOIN dorify.dori_queue q ON q.queue_id = qt.queue_id
JOIN dorify.dori_site s ON s.site_id = q.site_id
CROSS JOIN dorify.dori_user manager
CROSS JOIN (VALUES
  ('welcome'::varchar, 'sms'::varchar, NULL::int, NULL::int),
  ('threshold'::varchar, 'sms'::varchar, 5::int, NULL::int),
  ('threshold'::varchar, 'email'::varchar, NULL::int, 15::int)
) v(kind, channel, position, minutes)
WHERE s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager'
  AND qt.is_default;

-- 12,500 reusable people per site (50,000 total) for search, pagination and reports.
INSERT INTO dorify.dori_person (
  site_id, first_name, last_name, email, phone_number, birth_date,
  language_preference, created_by_user_id, updated_by_user_id,
  created_at, updated_at
)
SELECT s.site_id,
       (ARRAY['Alice','Bilal','Chloe','David','Emma','Farid','Giulia','Hugo'])[(g % 8) + 1],
       'Perf-' || LPAD(g::text, 6, '0'),
       'person.' || LPAD(g::text, 6, '0') || '@perf01.example.test',
       '+4915' || LPAD(g::text, 8, '0'),
       DATE '1940-01-01' + ((g * 37) % 22000),
       CASE WHEN g % 10 = 0 THEN 'en' ELSE 'fr' END,
       manager.user_id, manager.user_id,
       CURRENT_TIMESTAMP - ((g % 365) * INTERVAL '1 day'), CURRENT_TIMESTAMP
FROM generate_series(1, 12500) g
CROSS JOIN dorify.dori_site s
CROSS JOIN dorify.dori_user manager
WHERE s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager';

INSERT INTO dorify.dori_person_note (person_id, content, created_by_user_id)
SELECT p.person_id, 'Note PERF-01 synthetique pour tester les lectures avec notes.', manager.user_id
FROM dorify.dori_person p
JOIN dorify.dori_site s ON s.site_id = p.site_id
CROSS JOIN dorify.dori_user manager
WHERE s.site_name LIKE 'PERF-01 - %'
  AND manager.username = 'perf01_manager'
  AND p.last_name ~ '[05]$';
DO $$ BEGIN RAISE NOTICE 'stage=persons'; END $$;

-- One closed operator session per queue and business day over the last 60 days.
INSERT INTO dorify.dori_operator_session (
  queue_id, user_id, thread_number, mode, connected_at, last_seen_at,
  disconnected_at, closure_reason, closed_by_user_id
)
SELECT q.queue_id, operator.user_id, 1, 'active', d.day + TIME '06:50',
       d.day + TIME '20:00', d.day + TIME '20:05', 'logout', operator.user_id
FROM dorify.dori_queue q
JOIN dorify.dori_site s ON s.site_id = q.site_id
JOIN dorify.dori_user operator ON operator.username =
  'perf01_operator_' || RIGHT(q.queue_code, 1)
CROSS JOIN LATERAL (
  SELECT day::date AS day
  FROM generate_series(CURRENT_DATE - 60, CURRENT_DATE - 1, INTERVAL '1 day') day
  WHERE EXTRACT(ISODOW FROM day) <= 6
) d
WHERE s.site_name LIKE 'PERF-01 - %';
DO $$ BEGIN RAISE NOTICE 'stage=historical-sessions'; END $$;

-- Historical load: normal days plus deterministic contention peaks every 10th day.
WITH days AS (
  SELECT q.queue_id, q.queue_code, q.site_id, d.day,
         CASE WHEN (CURRENT_DATE - d.day) % 10 = 0 THEN 600 ELSE 225 END AS volume
  FROM dorify.dori_queue q
  JOIN dorify.dori_site s ON s.site_id = q.site_id
  CROSS JOIN LATERAL (
    SELECT day::date AS day
    FROM generate_series(CURRENT_DATE - 60, CURRENT_DATE - 1, INTERVAL '1 day') day
    WHERE EXTRACT(ISODOW FROM day) <= 6
  ) d
  WHERE s.site_name LIKE 'PERF-01 - %'
), load AS (
  SELECT days.*, n,
         ROW_NUMBER() OVER (ORDER BY day, queue_id, n) AS global_n,
         day::timestamp + TIME '07:00' + n * INTERVAL '3 minutes' AS arrived_at,
         CASE WHEN volume > 100 THEN 20 + n % 75 ELSE 2 + n % 18 END AS wait_minutes,
         5 + n % 16 AS service_minutes
  FROM days CROSS JOIN LATERAL generate_series(1, days.volume) n
)
INSERT INTO dorify.dori_registration (
  person_id, queue_id, tier_id, business_date, ticket_number, entry_type,
  scheduled_time, checked_in_at, appointment_status, priority_reference_time,
  status, called_at, served_at, closed_at, served_by_session_id,
  served_by_user_id, registration_tracking_token_valid_until, payment_status,
  payment_amount, payment_currency, payment_method, paid_at, payment_reference,
  language_preference, created_by_user_id, updated_by_user_id, created_at, updated_at
)
SELECT p.person_id, load.queue_id, tier.tier_id, load.day,
       load.queue_code || LPAD(load.n::text, 5, '0'),
       CASE WHEN load.n % 5 = 0 THEN 'appointment' ELSE 'walkin' END,
       CASE WHEN load.n % 5 = 0 THEN load.arrived_at - INTERVAL '5 minutes' END,
       load.arrived_at,
       CASE WHEN load.n % 5 = 0 THEN 'checked_in' ELSE 'n/a' END,
       CASE WHEN load.n % 5 = 0 THEN load.arrived_at - INTERVAL '5 minutes' ELSE load.arrived_at END,
       CASE WHEN load.n % 37 = 0 THEN 'no_show' ELSE 'served' END,
       load.arrived_at + make_interval(mins => load.wait_minutes),
       CASE WHEN load.n % 37 = 0 THEN NULL ELSE load.arrived_at + make_interval(mins => load.wait_minutes + load.service_minutes) END,
       load.arrived_at + make_interval(mins => load.wait_minutes + load.service_minutes),
       os.session_id, os.user_id, load.day + INTERVAL '30 days',
       CASE WHEN load.n % 4 = 0 THEN 'paid' ELSE 'not_applicable' END,
       CASE WHEN load.n % 4 = 0 THEN 12 END,
       CASE WHEN load.n % 4 = 0 THEN 'EUR' END,
       CASE WHEN load.n % 8 = 0 THEN 'card' WHEN load.n % 4 = 0 THEN 'cash' END,
       CASE WHEN load.n % 4 = 0 THEN load.arrived_at END,
       CASE WHEN load.n % 4 = 0 THEN 'PERF01-' || load.day || '-' || load.queue_code || '-' || load.n END,
       CASE WHEN load.n % 10 = 0 THEN 'en' ELSE 'fr' END,
       os.user_id, os.user_id, load.arrived_at - INTERVAL '2 minutes',
       load.arrived_at + make_interval(mins => load.wait_minutes + load.service_minutes)
FROM load
JOIN dorify.dori_person p ON p.site_id = load.site_id
 AND p.last_name = 'Perf-' || LPAD((((load.global_n - 1) % 12500) + 1)::text, 6, '0')
JOIN dorify.dori_service_tier tier ON tier.tier_code = CASE
  WHEN load.n % 20 = 0 THEN 'premium'
  WHEN load.n % 4 = 0 THEN 'standard'
  ELSE 'free'
END
JOIN dorify.dori_operator_session os ON os.queue_id = load.queue_id
 AND os.connected_at::date = load.day;
DO $$ BEGIN RAISE NOTICE 'stage=historical-registrations'; END $$;

-- Active sessions and a sizeable queue for callNext contention tests today.
INSERT INTO dorify.dori_operator_session (
  queue_id, user_id, thread_number, mode, connected_at, last_seen_at
)
SELECT q.queue_id, operator.user_id, 1, 'active', CURRENT_DATE + TIME '06:50',
       CURRENT_TIMESTAMP
FROM dorify.dori_queue q
JOIN dorify.dori_site s ON s.site_id = q.site_id
JOIN dorify.dori_user operator ON operator.username =
  'perf01_operator_' || RIGHT(q.queue_code, 1)
WHERE s.site_name LIKE 'PERF-01 - %';

WITH current_load AS (
  SELECT q.queue_id, q.queue_code, q.site_id, n,
         ROW_NUMBER() OVER (ORDER BY q.queue_id, n) AS global_n
  FROM dorify.dori_queue q
  JOIN dorify.dori_site s ON s.site_id = q.site_id
  CROSS JOIN generate_series(1, 750) n
  WHERE s.site_name LIKE 'PERF-01 - %'
)
INSERT INTO dorify.dori_registration (
  person_id, queue_id, tier_id, business_date, ticket_number, entry_type,
  scheduled_time, checked_in_at, appointment_status, priority_reference_time,
  status, served_by_session_id, served_by_user_id, called_at,
  registration_tracking_token_valid_until, language_preference,
  created_by_user_id, updated_by_user_id, created_at, updated_at
)
SELECT p.person_id, current_load.queue_id, tier.tier_id, CURRENT_DATE,
       current_load.queue_code || LPAD(current_load.n::text, 5, '0'),
       CASE WHEN current_load.n % 5 = 0 THEN 'appointment' ELSE 'walkin' END,
       CASE WHEN current_load.n % 5 = 0 THEN CURRENT_DATE + TIME '07:00' + current_load.n * INTERVAL '2 minutes' END,
       CURRENT_DATE + TIME '07:00' + current_load.n * INTERVAL '2 minutes',
       CASE WHEN current_load.n % 5 = 0 THEN 'checked_in' ELSE 'n/a' END,
       CURRENT_DATE + TIME '07:00' + current_load.n * INTERVAL '2 minutes',
       CASE WHEN current_load.n = 1 THEN 'in_progress' ELSE 'waiting' END,
       CASE WHEN current_load.n = 1 THEN os.session_id END,
       CASE WHEN current_load.n = 1 THEN os.user_id END,
       CASE WHEN current_load.n = 1 THEN CURRENT_DATE + TIME '07:03' END,
       CURRENT_DATE + INTERVAL '30 days', 'fr', kiosk.user_id, kiosk.user_id,
       CURRENT_DATE + TIME '07:00' + current_load.n * INTERVAL '2 minutes', CURRENT_TIMESTAMP
FROM current_load
JOIN dorify.dori_person p ON p.site_id = current_load.site_id
 AND p.last_name = 'Perf-' || LPAD(current_load.n::text, 6, '0')
JOIN dorify.dori_service_tier tier ON tier.tier_code = CASE
  WHEN current_load.n % 25 = 0 THEN 'premium'
  WHEN current_load.n % 5 = 0 THEN 'standard'
  ELSE 'free'
END
JOIN dorify.dori_operator_session os ON os.queue_id = current_load.queue_id
 AND os.disconnected_at IS NULL
CROSS JOIN dorify.dori_user kiosk
WHERE kiosk.username = 'perf01_kiosk';
DO $$ BEGIN RAISE NOTICE 'stage=current-load'; END $$;

-- Future workload always spans the next two weeks from the execution date.
WITH future_load AS (
  SELECT q.queue_id, q.queue_code, q.site_id, d.day, n,
         ROW_NUMBER() OVER (ORDER BY d.day, q.queue_id, n) AS global_n,
         ROW_NUMBER() OVER (PARTITION BY q.queue_id ORDER BY d.day, n) AS queue_n
  FROM dorify.dori_queue q
  JOIN dorify.dori_site s ON s.site_id = q.site_id
  CROSS JOIN LATERAL (
    SELECT day::date AS day
    FROM generate_series(CURRENT_DATE + 1, CURRENT_DATE + 14, INTERVAL '1 day') day
    WHERE EXTRACT(ISODOW FROM day) <= 6
  ) d
  CROSS JOIN generate_series(1, 75) n
  WHERE s.site_name LIKE 'PERF-01 - %'
)
INSERT INTO dorify.dori_registration (
  person_id, queue_id, tier_id, business_date, ticket_number, entry_type,
  scheduled_time, appointment_status, priority_reference_time, status,
  registration_tracking_token_valid_until, language_preference,
  created_by_user_id, updated_by_user_id, created_at, updated_at
)
SELECT p.person_id, future_load.queue_id, tier.tier_id, future_load.day,
       future_load.queue_code || LPAD(future_load.n::text, 5, '0'), 'appointment',
       future_load.day + TIME '07:30' + future_load.n * INTERVAL '20 minutes',
       CASE WHEN future_load.global_n % 29 = 0 THEN 'cancelled'
            WHEN future_load.global_n % 23 = 0 THEN 'rescheduled' ELSE 'booked' END,
       future_load.day + TIME '07:30' + future_load.n * INTERVAL '20 minutes',
       CASE WHEN future_load.global_n % 29 = 0 THEN 'cancelled' ELSE 'booked' END,
       future_load.day + INTERVAL '45 days', 'fr', manager.user_id, manager.user_id,
       CURRENT_TIMESTAMP - ((future_load.global_n % 20) * INTERVAL '1 hour'), CURRENT_TIMESTAMP
FROM future_load
JOIN dorify.dori_person p ON p.site_id = future_load.site_id
 AND p.last_name = 'Perf-' || LPAD((750 + future_load.queue_n)::text, 6, '0')
JOIN dorify.dori_service_tier tier ON tier.tier_code = CASE
  WHEN future_load.n % 10 = 0 THEN 'premium'
  WHEN future_load.n % 3 = 0 THEN 'standard'
  ELSE 'free'
END
CROSS JOIN dorify.dori_user manager
WHERE manager.username = 'perf01_manager';
DO $$ BEGIN RAISE NOTICE 'stage=future-load'; END $$;

-- Notification volume for worker throughput and filtered-list tests.
INSERT INTO dorify.dori_notification (
  registration_id, rule_id, channel, notification_type, locale, recipient,
  notification_content, notification_status, provider_message_id, provider,
  failure_reason, attempt_count, sent_at, delivered_at, created_at, updated_at
)
SELECT r.registration_id, rule.rule_id, rule.channel, 'welcome', 'fr',
       CASE rule.channel WHEN 'sms' THEN p.phone_number ELSE p.email END,
       'Message synthetique PERF-01.',
       CASE (hashtext(r.registration_id::text) & 2147483647) % 20
         WHEN 0 THEN 'failed' WHEN 1 THEN 'pending' WHEN 2 THEN 'processing'
         WHEN 3 THEN 'sent' ELSE 'delivered' END,
       CASE WHEN (hashtext(r.registration_id::text) & 2147483647) % 20 NOT IN (0, 1, 2)
         THEN 'perf01-' || r.registration_id END,
       'perf01-provider',
       CASE WHEN (hashtext(r.registration_id::text) & 2147483647) % 20 = 0
         THEN 'Echec synthetique PERF-01' END,
       CASE WHEN (hashtext(r.registration_id::text) & 2147483647) % 20 = 0 THEN 3 ELSE 1 END,
       CASE WHEN (hashtext(r.registration_id::text) & 2147483647) % 20 NOT IN (0, 1, 2)
         THEN r.created_at + INTERVAL '1 minute' END,
       CASE WHEN (hashtext(r.registration_id::text) & 2147483647) % 20 > 3
         THEN r.created_at + INTERVAL '2 minutes' END,
       r.created_at, r.updated_at
FROM dorify.dori_registration r
JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
JOIN dorify.dori_site s ON s.site_id = q.site_id
JOIN dorify.dori_person p ON p.person_id = r.person_id
JOIN LATERAL (
  SELECT candidate.*
  FROM dorify.dori_queue_tier_notification_rule candidate
  WHERE candidate.queue_id = r.queue_id
    AND candidate.tier_id = r.tier_id
    AND candidate.notification_type = 'welcome'
  ORDER BY candidate.channel DESC
  LIMIT 1
) rule ON TRUE
WHERE s.site_name LIKE 'PERF-01 - %'
  AND (hashtext(r.registration_id::text) & 2147483647) % 3 = 0;
DO $$ BEGIN RAISE NOTICE 'stage=notifications'; END $$;

INSERT INTO dorify.dori_queue_daily_ticket_counter (
  queue_id, business_date, last_number, updated_at
)
SELECT r.queue_id, r.business_date, COUNT(*)::int, MAX(r.updated_at)
FROM dorify.dori_registration r
JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
JOIN dorify.dori_site s ON s.site_id = q.site_id
WHERE s.site_name LIKE 'PERF-01 - %'
GROUP BY r.queue_id, r.business_date;

INSERT INTO dorify.dori_queue_estimation_stats (
  site_id, queue_id, activity_date, window_started_at, window_ended_at,
  cycle_p50_minutes, cycle_p65_minutes, cycle_p90_minutes,
  wait_p50_minutes, wait_p65_minutes, wait_p90_minutes,
  sample_size, is_reliable, calculated_at
)
SELECT q.site_id, r.queue_id, r.business_date, r.business_date::timestamp,
       r.business_date::timestamp + INTERVAL '1 day',
       percentile_cont(.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at - r.called_at)) / 60)::int,
       percentile_cont(.65) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at - r.called_at)) / 60)::int,
       percentile_cont(.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.served_at - r.called_at)) / 60)::int,
       percentile_cont(.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)) / 60)::int,
       percentile_cont(.65) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)) / 60)::int,
       percentile_cont(.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)) / 60)::int,
       COUNT(*)::int, COUNT(*) >= 30,
       r.business_date::timestamp + INTERVAL '23 hours 55 minutes'
FROM dorify.dori_registration r
JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
JOIN dorify.dori_site s ON s.site_id = q.site_id
WHERE s.site_name LIKE 'PERF-01 - %'
  AND r.status = 'served' AND r.called_at IS NOT NULL AND r.served_at IS NOT NULL
GROUP BY q.site_id, r.queue_id, r.business_date;
DO $$ BEGIN RAISE NOTICE 'stage=stats'; END $$;

COMMIT;
