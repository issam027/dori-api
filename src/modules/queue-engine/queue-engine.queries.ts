/** Read-only SQL; the repository owns the repeatable-read transaction and parameters. */
export const cockpitReadQueries = {
  sites: `SELECT site_id, site_name, timezone
         FROM dorify.dori_site
         WHERE site_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
  operators: `SELECT user_id, username, full_name
         FROM dorify.dori_user
         WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
  queues: `WITH estimates AS MATERIALIZED (SELECT * FROM dorify.queue_wait_context($2::uuid[],$3,NULL::date,FALSE))
    SELECT q.queue_id,q.queue_code,q.queue_name,q.thread_count,
      e.waiting_count,e.active_threads AS occupied_threads_count,e.estimated_wait_minutes,
      (SELECT COUNT(*)::int FROM dorify.dori_registration r
       WHERE r.queue_id=q.queue_id AND r.business_date=e.business_date AND r.is_active
         AND r.entry_type='appointment' AND r.status IN ('booked','waiting')
         AND r.appointment_status NOT IN ('cancelled','expired')) AS remaining_appointments_count
    FROM dorify.dori_queue q JOIN estimates e USING(queue_id)
    WHERE q.site_id=$1 AND q.queue_id=ANY($2::uuid[]) AND q.is_active AND q.deleted_at IS NULL
    ORDER BY q.queue_name,q.queue_id`,
  sessions: `SELECT os.session_id, os.queue_id, os.user_id, os.thread_number,
                os.counter_name, COALESCE(u.full_name, u.username) AS operator_name
         FROM dorify.dori_operator_session os
         JOIN dorify.dori_user u ON u.user_id = os.user_id
         WHERE os.queue_id = ANY($1::uuid[])
           AND os.disconnected_at IS NULL AND os.mode = 'active'
         ORDER BY os.queue_id, os.thread_number`,
  activeCalls: `SELECT r.registration_id, r.queue_id, r.ticket_number, r.status,
                r.entry_type, r.scheduled_time, r.called_at,
                r.recall_count, r.last_recalled_at,
                p.person_id, p.first_name, p.last_name, p.phone_number,
                t.tier_id, t.tier_code, t.tier_name,
                (SELECT COUNT(*)::int FROM dorify.dori_person_note note
                 WHERE note.person_id = p.person_id AND note.is_active = TRUE
                   AND note.deleted_at IS NULL) AS notes_count
         FROM dorify.dori_registration r
         JOIN dorify.dori_operator_session os
           ON os.session_id = r.served_by_session_id
          AND os.disconnected_at IS NULL AND os.mode = 'active'
         JOIN dorify.dori_person p ON p.person_id = r.person_id
         JOIN dorify.dori_service_tier t ON t.tier_id = r.tier_id
         WHERE r.queue_id = ANY($1::uuid[]) AND r.served_by_user_id = $2
           AND r.status = 'in_progress' AND r.is_active = TRUE`,
  candidates: `SELECT ranked.queue_id,r.ticket_number,r.entry_type,r.scheduled_time,r.priority_reference_time,
      t.tier_id,t.tier_code,t.tier_name,ranked.called_early,ranked.score,ranked.position AS candidate_rank
    FROM dorify.queue_operational_ranking($1::uuid[],$2) ranked
    JOIN dorify.dori_registration r ON r.registration_id=ranked.registration_id
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id JOIN dorify.dori_site s ON s.site_id=q.site_id
    JOIN dorify.dori_service_tier t ON t.tier_id=r.tier_id
    WHERE ranked.business_date=($2::timestamptz AT TIME ZONE s.timezone)::date AND ranked.position<=$3
    ORDER BY ranked.queue_id,ranked.position`,
  recentPassages: `SELECT r.registration_id, r.queue_id, q.queue_name,
                      r.ticket_number,
                      COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), '—') AS person_name,
                      os.thread_number, os.counter_name,
                      r.called_at, r.closed_at, r.status AS outcome
               FROM dorify.dori_registration r
               JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
               JOIN dorify.dori_person p ON p.person_id = r.person_id
               LEFT JOIN dorify.dori_operator_session os
                 ON os.session_id = r.served_by_session_id
               WHERE r.queue_id = ANY($1::uuid[]) AND r.served_by_user_id = $2
                 AND r.status IN ('served', 'no_show') AND r.closed_at IS NOT NULL
               ORDER BY r.closed_at DESC, r.registration_id DESC
               LIMIT $3`,
} as const;
