-- Donnees de demonstration couvrant septembre et octobre 2026.
-- Pour rejouer : executer d'abord cleanup-example-site-september-october-2026.sql.
BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM dori_site WHERE site_name='DEMO - Centre Horizon')
     OR EXISTS (SELECT 1 FROM dori_user WHERE username LIKE 'demo_horizon_%') THEN
    RAISE EXCEPTION 'Le jeu DEMO Centre Horizon existe deja : lancez le script de nettoyage.';
  END IF;
END $$;

INSERT INTO dori_user(username,email,password_hash,user_type,language_preference,must_change_password) VALUES
 ('demo_horizon_manager','manager.horizon@example.test',crypt('Demo-Horizon-2026!',gen_salt('bf')),'human','fr',TRUE),
 ('demo_horizon_accueil','accueil.horizon@example.test',crypt('Demo-Horizon-2026!',gen_salt('bf')),'human','fr',TRUE),
 ('demo_horizon_labo','labo.horizon@example.test',crypt('Demo-Horizon-2026!',gen_salt('bf')),'human','fr',TRUE),
 ('demo_horizon_imagerie','imagerie.horizon@example.test',crypt('Demo-Horizon-2026!',gen_salt('bf')),'human','fr',TRUE),
 ('demo_horizon_kiosk',NULL,crypt('Demo-Horizon-2026!',gen_salt('bf')),'kiosk','fr',TRUE);

INSERT INTO dori_user_role(user_id,role_id)
SELECT u.user_id,r.role_id FROM dori_user u JOIN dori_role r ON r.role_name=CASE
 WHEN u.username='demo_horizon_manager' THEN 'manager'
 WHEN u.username='demo_horizon_kiosk' THEN 'kiosk' ELSE 'operator' END
WHERE u.username LIKE 'demo_horizon_%';

INSERT INTO dori_site(site_name,site_location,site_type,timezone,default_currency,
 default_appointments_enabled,default_appointment_slot_duration,default_slot_capacity,
 default_working_hours_start,default_working_hours_end,default_break_start,default_break_end,
 default_late_tolerance_minutes,default_locale,created_by_user_id,updated_by_user_id)
SELECT 'DEMO - Centre Horizon','12 avenue Habib-Bourguiba, Tunis','public','Africa/Tunis','TND',
 TRUE,20,2,'08:00','18:00','12:30','13:30',20,'fr',user_id,user_id
FROM dori_user WHERE username='demo_horizon_manager';

INSERT INTO dori_user_site_assignment(user_id,site_id,assigned_by_user_id)
SELECT u.user_id,s.site_id,m.user_id FROM dori_user u CROSS JOIN dori_site s CROSS JOIN dori_user m
WHERE u.username LIKE 'demo_horizon_%' AND s.site_name='DEMO - Centre Horizon'
 AND m.username='demo_horizon_manager';

INSERT INTO dori_queue(queue_code,site_id,queue_name,average_wait_time,thread_count,
 appointments_enabled,appointment_slot_duration,slot_capacity,working_hours_start,working_hours_end,
 break_start,break_end,locale,currency,created_by_user_id,updated_by_user_id)
SELECT v.code,s.site_id,v.name,v.wait,v.threads,TRUE,v.slot,v.capacity,'08:00','18:00','12:30','13:30',
 'fr','TND',m.user_id,m.user_id
FROM dori_site s CROSS JOIN dori_user m CROSS JOIN (VALUES
 ('ACC','Accueil & consultations',12,2,20,2),
 ('LAB','Laboratoire',18,1,15,3),
 ('IMG','Imagerie',25,2,30,1)) v(code,name,wait,threads,slot,capacity)
WHERE s.site_name='DEMO - Centre Horizon' AND m.username='demo_horizon_manager';

INSERT INTO dori_user_queue_assignment(user_id,queue_id,assigned_by_user_id)
SELECT u.user_id,q.queue_id,m.user_id FROM dori_user u
JOIN dori_queue q ON q.queue_code=CASE u.username WHEN 'demo_horizon_accueil' THEN 'ACC'
 WHEN 'demo_horizon_labo' THEN 'LAB' WHEN 'demo_horizon_imagerie' THEN 'IMG' END
JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon' CROSS JOIN dori_user m
WHERE u.username IN ('demo_horizon_accueil','demo_horizon_labo','demo_horizon_imagerie')
 AND m.username='demo_horizon_manager';

INSERT INTO dori_queue_service_tier(queue_id,tier_id,price,currency,display_order,is_default,created_by_user_id,updated_by_user_id)
SELECT q.queue_id,t.tier_id,CASE t.tier_code WHEN 'free' THEN 0 WHEN 'standard' THEN 8 ELSE 18 END,
 'TND',CASE t.tier_code WHEN 'free' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,t.tier_code='free',m.user_id,m.user_id
FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
CROSS JOIN dori_service_tier t CROSS JOIN dori_user m
WHERE t.tier_code IN ('free','standard','premium') AND m.username='demo_horizon_manager';

INSERT INTO dori_queue_tier_notification_rule(queue_id,tier_id,notification_type,channel,
 threshold_position,threshold_minutes,include_tracking_link,created_by_user_id,updated_by_user_id)
SELECT qt.queue_id,qt.tier_id,v.kind,v.channel,v.pos,v.minutes,TRUE,m.user_id,m.user_id
FROM dori_queue_service_tier qt JOIN dori_queue q ON q.queue_id=qt.queue_id
JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
CROSS JOIN dori_user m CROSS JOIN (VALUES
 ('welcome'::varchar,'sms'::varchar,NULL::int,NULL::int),
 ('threshold'::varchar,'sms'::varchar,3::int,NULL::int),
 ('threshold'::varchar,'email'::varchar,NULL::int,20::int)) v(kind,channel,pos,minutes)
WHERE m.username='demo_horizon_manager' AND qt.is_default;

INSERT INTO dori_person(site_id,first_name,last_name,email,phone_number,birth_date,
 language_preference,created_by_user_id,updated_by_user_id)
SELECT s.site_id,(ARRAY['Amira','Mohamed','Ines','Youssef','Mariem','Ahmed','Sarra','Aziz','Rania','Mehdi'])[(g%10)+1],
 'DemoHorizon-'||lpad(g::text,3,'0'),'patient.'||lpad(g::text,3,'0')||'@example.test',
 '+216'||(20000000+g)::text,DATE '1955-01-01'+((g*43)%18000),CASE WHEN g%9=0 THEN 'ar' ELSE 'fr' END,m.user_id,m.user_id
FROM generate_series(1,360) g CROSS JOIN dori_site s CROSS JOIN dori_user m
WHERE s.site_name='DEMO - Centre Horizon' AND m.username='demo_horizon_manager';

INSERT INTO dori_person_note(person_id,content,created_by_user_id)
SELECT p.person_id,CASE row_number() OVER(ORDER BY p.person_id)%5
 WHEN 0 THEN 'Mobilite reduite : proposer une place assise et un accompagnement.'
 WHEN 1 THEN 'Prefere les notifications par SMS.'
 WHEN 2 THEN 'Dossier administratif a verifier avant le passage.'
 WHEN 3 THEN 'Allergie au produit de contraste signalee par le patient.'
 ELSE 'Contact de confiance enregistre dans le dossier papier.' END,m.user_id
FROM dori_person p JOIN dori_site s ON s.site_id=p.site_id AND s.site_name='DEMO - Centre Horizon'
CROSS JOIN dori_user m WHERE m.username='demo_horizon_manager' AND p.person_id%7=0;

-- Sessions historiques fermees, une par file et jour ouvre.
INSERT INTO dori_operator_session(queue_id,user_id,thread_number,mode,connected_at,last_seen_at,
 disconnected_at,closure_reason,closed_by_user_id)
SELECT q.queue_id,u.user_id,1,'active',d.day+TIME '07:45',d.day+TIME '18:05',d.day+TIME '18:10','logout',u.user_id
FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
JOIN dori_user u ON u.username=CASE q.queue_code WHEN 'ACC' THEN 'demo_horizon_accueil'
 WHEN 'LAB' THEN 'demo_horizon_labo' ELSE 'demo_horizon_imagerie' END
CROSS JOIN LATERAL (SELECT day::date FROM generate_series(DATE '2026-09-01',DATE '2026-10-19',INTERVAL '1 day') day
 WHERE EXTRACT(ISODOW FROM day)<=6) d;

-- Historique mixte. Les 15/09, 06/10 et 13/10 sont des goulots : 34 arrivees/file et attente longue.
WITH base AS (
 SELECT q.queue_id,q.queue_code,q.site_id,d.day::date business_date,
  CASE WHEN d.day::date IN (DATE '2026-09-15',DATE '2026-10-06',DATE '2026-10-13') THEN 34
       WHEN EXTRACT(ISODOW FROM d.day)=6 THEN 8 ELSE 16 END volume
 FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
 CROSS JOIN generate_series(DATE '2026-09-01',DATE '2026-10-19',INTERVAL '1 day') d(day)
 WHERE EXTRACT(ISODOW FROM d.day)<=6), x AS (
 SELECT b.*,n,row_number() OVER(ORDER BY business_date,queue_id,n) global_n,
  b.business_date::timestamp+TIME '08:00'+n*INTERVAL '22 minutes' arrival,
  CASE WHEN b.business_date IN (DATE '2026-09-15',DATE '2026-10-06',DATE '2026-10-13') THEN 35+n%45 ELSE 4+n%14 END wait_m,
  CASE WHEN b.business_date IN (DATE '2026-09-15',DATE '2026-10-06',DATE '2026-10-13') THEN 18+n%28 ELSE 7+n%13 END service_m
 FROM base b CROSS JOIN LATERAL generate_series(1,b.volume) n)
INSERT INTO dori_registration(person_id,queue_id,tier_id,business_date,ticket_number,entry_type,
 scheduled_time,checked_in_at,appointment_status,priority_reference_time,status,served_by_session_id,
 served_by_user_id,called_at,served_at,closed_at,registration_tracking_token_valid_until,payment_status,
 payment_amount,payment_currency,payment_method,paid_at,payment_reference,language_preference,
 created_by_user_id,updated_by_user_id,created_at,updated_at)
SELECT p.person_id,x.queue_id,t.tier_id,x.business_date,x.queue_code||lpad(x.n::text,4,'0'),
 CASE WHEN x.n%4=0 THEN 'appointment' ELSE 'walkin' END,
 CASE WHEN x.n%4=0 THEN x.arrival-INTERVAL '5 minutes' ELSE NULL END,x.arrival,
 CASE WHEN x.n%4=0 THEN 'checked_in' ELSE 'n/a' END,
 CASE WHEN x.n%4=0 THEN x.arrival-INTERVAL '5 minutes' ELSE x.arrival END,
 CASE WHEN x.n%17=0 THEN 'no_show' ELSE 'served' END,os.session_id,os.user_id,
 x.arrival+make_interval(mins=>x.wait_m),
 CASE WHEN x.n%17=0 THEN NULL ELSE x.arrival+make_interval(mins=>x.wait_m+x.service_m) END,
 x.arrival+make_interval(mins=>x.wait_m+x.service_m),x.business_date+INTERVAL '30 days',
 CASE WHEN x.n%5=0 THEN 'paid' ELSE 'not_applicable' END,
 CASE WHEN x.n%5=0 THEN CASE t.tier_code WHEN 'standard' THEN 8 ELSE 18 END END,
 CASE WHEN x.n%5=0 THEN 'TND' END,CASE WHEN x.n%10=0 THEN 'card' WHEN x.n%5=0 THEN 'cash' END,
 CASE WHEN x.n%5=0 THEN x.arrival END,CASE WHEN x.n%5=0 THEN 'DEMO-'||x.business_date||'-'||x.queue_code||'-'||x.n END,
 CASE WHEN x.n%9=0 THEN 'en' ELSE 'fr' END,os.user_id,os.user_id,x.arrival-INTERVAL '10 minutes',
 x.arrival+make_interval(mins=>x.wait_m+x.service_m)
FROM x JOIN dori_person p ON p.site_id=x.site_id AND p.last_name='DemoHorizon-'||lpad((((x.global_n-1)%240)+1)::text,3,'0')
JOIN dori_service_tier t ON t.tier_code=CASE WHEN x.n%11=0 THEN 'premium' WHEN x.n%5=0 THEN 'standard' ELSE 'free' END
JOIN dori_operator_session os ON os.queue_id=x.queue_id AND os.connected_at::date=x.business_date;

-- Sessions actives et file courante du 20 octobre.
INSERT INTO dori_operator_session(queue_id,user_id,thread_number,mode,connected_at,last_seen_at)
SELECT q.queue_id,u.user_id,1,'active',TIMESTAMPTZ '2026-10-20 07:45:00+01',TIMESTAMPTZ '2026-10-20 10:30:00+01'
FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
JOIN dori_user u ON u.username=CASE q.queue_code WHEN 'ACC' THEN 'demo_horizon_accueil'
 WHEN 'LAB' THEN 'demo_horizon_labo' ELSE 'demo_horizon_imagerie' END;

WITH x AS (SELECT q.queue_id,q.queue_code,q.site_id,n,row_number() OVER(ORDER BY q.queue_id,n) rn
 FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
 CROSS JOIN generate_series(1,7)n)
INSERT INTO dori_registration(person_id,queue_id,tier_id,business_date,ticket_number,entry_type,scheduled_time,
 checked_in_at,appointment_status,priority_reference_time,status,served_by_session_id,served_by_user_id,called_at,
 registration_tracking_token_valid_until,language_preference,created_by_user_id,updated_by_user_id,created_at,updated_at)
SELECT p.person_id,x.queue_id,t.tier_id,DATE '2026-10-20',x.queue_code||lpad(x.n::text,4,'0'),
 CASE WHEN x.n%3=0 THEN 'appointment' ELSE 'walkin' END,
 CASE WHEN x.n%3=0 THEN TIMESTAMPTZ '2026-10-20 09:00:00+01'+x.n*INTERVAL '20 minutes' END,
 TIMESTAMPTZ '2026-10-20 09:00:00+01'+x.n*INTERVAL '12 minutes',
 CASE WHEN x.n%3=0 THEN 'checked_in' ELSE 'n/a' END,
 CASE WHEN x.n%3=0
   THEN TIMESTAMPTZ '2026-10-20 09:00:00+01'+x.n*INTERVAL '20 minutes'
   ELSE TIMESTAMPTZ '2026-10-20 09:00:00+01'+x.n*INTERVAL '12 minutes'
 END,
 CASE WHEN x.n=1 THEN 'in_progress' ELSE 'waiting' END,
 CASE WHEN x.n=1 THEN os.session_id END,CASE WHEN x.n=1 THEN os.user_id END,
 CASE WHEN x.n=1 THEN TIMESTAMPTZ '2026-10-20 10:05:00+01' END,TIMESTAMPTZ '2026-11-20 23:59:00+01',
 'fr',k.user_id,k.user_id,TIMESTAMPTZ '2026-10-20 08:50:00+01'+x.n*INTERVAL '12 minutes',CURRENT_TIMESTAMP
FROM x JOIN dori_person p ON p.site_id=x.site_id AND p.last_name='DemoHorizon-'||lpad((240+x.rn)::text,3,'0')
JOIN dori_service_tier t ON t.tier_code=CASE WHEN x.n=7 THEN 'premium' ELSE 'free' END
JOIN dori_operator_session os ON os.queue_id=x.queue_id AND os.disconnected_at IS NULL
CROSS JOIN dori_user k WHERE k.username='demo_horizon_kiosk';

-- Rendez-vous jusqu'au 31 octobre, dont quelques annulations/replanifications.
WITH x AS (SELECT q.queue_id,q.queue_code,q.site_id,d.day::date business_date,n,
 row_number() OVER(ORDER BY d.day,q.queue_id,n) rn
 FROM dori_queue q JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
 CROSS JOIN generate_series(DATE '2026-10-21',DATE '2026-10-31',INTERVAL '1 day')d(day)
 CROSS JOIN generate_series(1,2)n)
INSERT INTO dori_registration(person_id,queue_id,tier_id,business_date,ticket_number,entry_type,scheduled_time,
 checked_in_at,appointment_status,priority_reference_time,status,registration_tracking_token_valid_until,
 language_preference,created_by_user_id,updated_by_user_id,created_at,updated_at)
SELECT p.person_id,x.queue_id,t.tier_id,x.business_date,x.queue_code||lpad(x.n::text,4,'0'),'appointment',
 x.business_date::timestamp+TIME '09:00'+x.n*INTERVAL '90 minutes',NULL,
 CASE WHEN x.rn%19=0 THEN 'cancelled' WHEN x.rn%13=0 THEN 'rescheduled' ELSE 'booked' END,
 x.business_date::timestamp+TIME '09:00'+x.n*INTERVAL '90 minutes',
 CASE WHEN x.rn%19=0 THEN 'cancelled' ELSE 'booked' END,x.business_date+INTERVAL '45 days','fr',m.user_id,m.user_id,
 TIMESTAMPTZ '2026-10-01 10:00:00+01'+x.rn*INTERVAL '2 minutes',CURRENT_TIMESTAMP
FROM x JOIN dori_person p ON p.site_id=x.site_id AND p.last_name='DemoHorizon-'||lpad((270+x.rn)::text,3,'0')
JOIN dori_service_tier t ON t.tier_code=CASE WHEN x.n=2 THEN 'standard' ELSE 'free' END
CROSS JOIN dori_user m WHERE m.username='demo_horizon_manager';

-- Notifications livrees, envoyees et en echec.
INSERT INTO dori_notification(registration_id,rule_id,channel,notification_type,locale,recipient,notification_content,
 notification_status,provider_message_id,provider,failure_reason,attempt_count,sent_at,delivered_at,created_at,updated_at)
SELECT r.registration_id,rule.rule_id,rule.channel,'welcome','fr',CASE rule.channel WHEN 'sms' THEN p.phone_number ELSE p.email END,
 'Bienvenue au Centre Horizon. Suivez votre tour avec votre lien de suivi.',
 CASE r.registration_id%12 WHEN 0 THEN 'failed' WHEN 1 THEN 'sent' ELSE 'delivered' END,
 CASE WHEN r.registration_id%12<>0 THEN 'demo-msg-'||r.registration_id END,'demo-provider',
 CASE WHEN r.registration_id%12=0 THEN 'Numero temporairement indisponible' END,
 CASE WHEN r.registration_id%12=0 THEN 3 ELSE 1 END,
 CASE WHEN r.registration_id%12<>0 THEN r.created_at+INTERVAL '1 minute' END,
 CASE WHEN r.registration_id%12 NOT IN(0,1) THEN r.created_at+INTERVAL '2 minutes' END,r.created_at,r.created_at+INTERVAL '2 minutes'
FROM dori_registration r JOIN dori_queue q ON q.queue_id=r.queue_id
JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon' JOIN dori_person p ON p.person_id=r.person_id
JOIN LATERAL(SELECT rr.* FROM dori_queue_tier_notification_rule rr WHERE rr.queue_id=r.queue_id
 AND rr.tier_id=r.tier_id AND rr.notification_type='welcome' ORDER BY rr.channel DESC LIMIT 1)rule ON TRUE
WHERE r.registration_id%5=0;

INSERT INTO dori_queue_daily_ticket_counter(queue_id,business_date,last_number,updated_at)
SELECT r.queue_id,r.business_date,count(*)::int,max(r.updated_at) FROM dori_registration r
JOIN dori_queue q ON q.queue_id=r.queue_id JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
GROUP BY r.queue_id,r.business_date;

-- Percentiles en minutes, calcules independamment pour chaque jour d'activite.
INSERT INTO dori_queue_estimation_stats(site_id,queue_id,activity_date,window_started_at,window_ended_at,
 cycle_p50_minutes,cycle_p65_minutes,cycle_p90_minutes,wait_p50_minutes,wait_p65_minutes,wait_p90_minutes,
 sample_size,is_reliable,calculated_at)
SELECT q.site_id,r.queue_id,r.business_date,r.business_date::timestamp,r.business_date::timestamp+INTERVAL '1 day',
 percentile_cont(.50)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.served_at-r.called_at))/60)::int,
 percentile_cont(.65)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.served_at-r.called_at))/60)::int,
 percentile_cont(.90)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.served_at-r.called_at))/60)::int,
 percentile_cont(.50)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.called_at-r.checked_in_at))/60)::int,
 percentile_cont(.65)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.called_at-r.checked_in_at))/60)::int,
 percentile_cont(.90)WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(r.called_at-r.checked_in_at))/60)::int,
 count(*)::int,count(*)>=30,r.business_date::timestamp+INTERVAL '23 hours 55 minutes'
FROM dori_registration r JOIN dori_queue q ON q.queue_id=r.queue_id
JOIN dori_site s ON s.site_id=q.site_id AND s.site_name='DEMO - Centre Horizon'
WHERE r.status='served' AND r.called_at IS NOT NULL AND r.served_at IS NOT NULL
GROUP BY q.site_id,r.queue_id,r.business_date;

COMMIT;
