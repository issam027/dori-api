-- All results must be zero. PostgreSQL constraints provide the remaining integrity checks.
SELECT
  (SELECT count(*) FROM dorify.dori_registration r
   JOIN dorify.dori_queue q USING(queue_id)
   JOIN dorify.dori_person p USING(person_id)
   WHERE q.site_id <> p.site_id) AS tickets_outside_customer_site,
  (SELECT count(*) FROM dorify.dori_registration r
   JOIN dorify.dori_operator_session s ON s.session_id=r.served_by_session_id
   WHERE s.queue_id<>r.queue_id OR s.user_id<>r.served_by_user_id) AS inconsistent_operator_sessions,
  (SELECT count(*) FROM dorify.dori_registration r
   JOIN dorify.dori_queue_service_tier t USING(queue_id,tier_id)
   WHERE r.status IN ('waiting','booked','in_progress') AND NOT t.is_active) AS open_tickets_on_inactive_services,
  (SELECT count(*) FROM dorify.dori_user_queue_assignment a
   JOIN dorify.dori_queue q USING(queue_id)
   LEFT JOIN dorify.dori_user_site_assignment s ON s.user_id=a.user_id AND s.site_id=q.site_id
   WHERE s.user_id IS NULL) AS missing_site_assignments,
  (SELECT count(*) FROM (
     SELECT r.queue_id,r.business_date,max(right(r.ticket_number,5)::integer) AS ticket_max
     FROM dorify.dori_registration r GROUP BY r.queue_id,r.business_date
   ) tickets LEFT JOIN dorify.dori_queue_daily_ticket_counter c USING(queue_id,business_date)
   WHERE c.last_number IS NULL OR c.last_number<ticket_max) AS insufficient_ticket_counters,
  (SELECT count(*) FROM dorify.dori_registration r
   JOIN dorify.dori_queue q USING(queue_id) JOIN dorify.dori_site s USING(site_id)
   WHERE r.status='booked' AND (
     NOT coalesce(q.appointments_enabled,s.default_appointments_enabled)
     OR extract(isodow FROM r.scheduled_time AT TIME ZONE s.timezone)::integer <> ALL(coalesce(q.working_days,s.default_working_days))
     OR (r.scheduled_time AT TIME ZONE s.timezone)::time < coalesce(q.working_hours_start,s.default_working_hours_start)
     OR (r.scheduled_time AT TIME ZONE s.timezone)::time >= coalesce(q.working_hours_end,s.default_working_hours_end)
     OR (r.scheduled_time AT TIME ZONE s.timezone)::time >= coalesce(q.break_start,s.default_break_start)
        AND (r.scheduled_time AT TIME ZONE s.timezone)::time < coalesce(q.break_end,s.default_break_end)
   )) AS appointments_outside_calendar;
