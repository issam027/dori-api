/** Read-only SQL; the repository owns the repeatable-read transaction and parameters. */
export const cockpitReadQueries = {
  sites: `SELECT site_id, site_name, timezone
         FROM dorify.dori_site
         WHERE site_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
  operators: `SELECT user_id, username, full_name
         FROM dorify.dori_user
         WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
  queues: `SELECT q.queue_id, q.queue_code, q.queue_name, q.thread_count,
                q.average_wait_time,
                COALESCE(rc.waiting_count, 0) AS waiting_count,
                COALESCE(rc.remaining_appointments_count, 0) AS remaining_appointments_count,
                COALESCE(sc.occupied_threads_count, 0) AS occupied_threads_count,
                stat.cycle_p50_minutes
         FROM dorify.dori_queue q
         JOIN dorify.dori_site s ON s.site_id = q.site_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*) FILTER (
                    WHERE r.status = 'waiting'
                  )::int AS waiting_count,
                  COUNT(*) FILTER (
                    WHERE r.entry_type = 'appointment'
                      AND r.status IN ('booked', 'waiting')
                      AND r.appointment_status NOT IN ('cancelled', 'expired')
                  )::int AS remaining_appointments_count
           FROM dorify.dori_registration r
           WHERE r.queue_id = q.queue_id AND r.is_active = TRUE
             AND r.business_date = ($3::timestamptz AT TIME ZONE s.timezone)::date
         ) rc ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS occupied_threads_count
           FROM dorify.dori_operator_session os
           WHERE os.queue_id = q.queue_id AND os.disconnected_at IS NULL
             AND os.mode = 'active'
         ) sc ON TRUE
         LEFT JOIN LATERAL (
           SELECT estimation.cycle_p50_minutes
           FROM dorify.dori_queue_estimation_stats estimation
           WHERE estimation.site_id = q.site_id
             AND estimation.queue_id = q.queue_id
           ORDER BY
             (estimation.activity_date = ($3::timestamptz AT TIME ZONE s.timezone)::date) DESC,
             estimation.activity_date DESC,
             estimation.calculated_at DESC
           LIMIT 1
         ) stat ON TRUE
         WHERE q.site_id = $1 AND q.queue_id = ANY($2::uuid[])
           AND q.is_active = TRUE AND q.deleted_at IS NULL
         ORDER BY q.queue_name ASC, q.queue_id ASC`,
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
  candidates: `WITH ranked AS (
                 SELECT r.queue_id, r.ticket_number, r.entry_type,
                        r.scheduled_time, r.priority_reference_time,
                        t.tier_id, t.tier_code, t.tier_name,
                        CASE WHEN r.entry_type = 'appointment'
                                  AND r.scheduled_time > $2
                          THEN TRUE ELSE FALSE END AS called_early,
                        ROUND((CASE WHEN r.entry_type = 'appointment'
                          THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                            + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                              * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
                          ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                            + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                              * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
                        END)::numeric, 2) AS score,
                        ROW_NUMBER() OVER (
                          PARTITION BY r.queue_id
                          ORDER BY
                            CASE WHEN r.entry_type = 'appointment' AND r.scheduled_time > $2
                              THEN 1 ELSE 0 END,
                            CASE WHEN r.entry_type = 'appointment'
                              THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                                + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                                  * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
                              ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                                + EXTRACT(EPOCH FROM ($2 - r.priority_reference_time))/60
                                  * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
                            END DESC,
                            r.priority_reference_time ASC,
                            r.registration_id ASC
                        ) AS candidate_rank
                 FROM dorify.dori_registration r
                 JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
                 JOIN dorify.dori_site s ON s.site_id = q.site_id
                 JOIN dorify.dori_service_tier t ON t.tier_id = r.tier_id
                 WHERE r.queue_id = ANY($1::uuid[])
                   AND r.business_date = ($2::timestamptz AT TIME ZONE s.timezone)::date
                   AND r.status = 'waiting' AND r.is_active = TRUE
                   AND (r.entry_type = 'walkin' OR r.appointment_status = 'checked_in')
               )
               SELECT * FROM ranked WHERE candidate_rank <= $3
               ORDER BY queue_id, candidate_rank`,
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
