import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { enqueueRealtimeEvent } from '../../core/realtime/realtime.repository';

export interface ActiveThreadSessionRow {
  session_id: string;
  user_id: string;
  thread_number: number;
  counter_name: string | null;
  username: string;
  connected_at: Date | string;
  last_seen_at: Date | string;
  current_registration_id: string | null;
}
export interface QueueSessionRow extends Record<string, unknown> {
  session_id: string;
  queue_id: string;
  user_id: string;
  thread_number: number | null;
  counter_name: string | null;
  mode: 'active' | 'consultation_only';
  connected_at: Date | string;
  last_seen_at: Date | string;
  disconnected_at?: Date | string | null;
  username?: string;
}

export interface NextCandidateRow extends Record<string, unknown> {
  registration_id: string;
  ticket_number: string;
  entry_type: 'walkin' | 'appointment';
  scheduled_time: string | null;
  status: string;
  called_at: string;
  registration_tracking_token: string;
  tier_id: string;
  tier_code: string;
  tier_name: string;
  person_id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  notes_count: number;
  score: number;
  called_early: boolean;
}

export interface SiteNextCandidateRow extends NextCandidateRow {
  queue_id: string;
  queue_name: string;
  session_id: string;
  thread_number: number;
}

export type SiteCallNextResult =
  | { outcome: 'no_session' | 'empty' }
  | { outcome: 'called'; candidate: SiteNextCandidateRow };

export interface CockpitData {
  site: Record<string, unknown> | null;
  operator: Record<string, unknown> | null;
  queues: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  activeCalls: Array<Record<string, unknown>>;
  candidates: Array<Record<string, unknown>>;
  recentPassages: Array<Record<string, unknown>>;
}

export interface PreviewCandidateRow extends Record<string, unknown> {
  registration_id: string;
  ticket_number: string;
  entry_type: 'walkin' | 'appointment';
  scheduled_time: string | null;
  queue_id: string;
  queue_code: string;
  queue_name: string;
  site_name: string;
  person_id: string;
  first_name: string;
  last_name: string;
  score?: number;
  called_early: boolean;
}

export type RecallRegistrationResult =
  | { outcome: 'not_found' }
  | { outcome: 'not_in_progress' }
  | { outcome: 'session_unavailable' }
  | { outcome: 'forbidden' }
  | {
      outcome: 'recalled';
      registration_id: string;
      queue_id: string;
      ticket_number: string;
      status: 'in_progress';
      session_id: string;
      thread_number: number;
      counter_name: string | null;
      last_recalled_at: Date | string;
      recall_count: number;
    };

const SESSION_COLUMNS = `session_id, queue_id, user_id, thread_number, counter_name, mode,
  connected_at, last_seen_at, disconnected_at, closure_reason, closed_by_user_id`;
const sessionColumns = (alias: string) =>
  SESSION_COLUMNS.split(',')
    .map((column) => `${alias}.${column.trim()}`)
    .join(', ');

@Injectable()
export class QueueEngineRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findThreadState(queueId: string): Promise<{
    threadCount: number;
    sessions: ActiveThreadSessionRow[];
  } | null> {
    const queues: Array<{ thread_count: number }> = await this.dataSource.query(
      'SELECT thread_count FROM dorify.dori_queue WHERE queue_id = $1 AND is_active = TRUE',
      [queueId],
    );
    if (!queues.length) return null;
    const sessions: ActiveThreadSessionRow[] = await this.dataSource.query(
      `SELECT ${sessionColumns('qs')}, u.username, c.registration_id AS current_registration_id
       FROM dorify.dori_operator_session qs JOIN dorify.dori_user u ON u.user_id = qs.user_id
       LEFT JOIN dorify.dori_registration c ON c.served_by_session_id = qs.session_id
         AND c.status = 'in_progress' AND c.is_active = TRUE
       WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL AND qs.mode = 'active'`,
      [queueId],
    );
    return { threadCount: queues[0].thread_count || 1, sessions };
  }

  async closeSession(
    queueId: string,
    sessionId: string,
    closedBy: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dorify.dori_operator_session SET disconnected_at = $1,
       closure_reason = 'logout', closed_by_user_id = $2
       WHERE session_id = $3 AND queue_id = $4 AND disconnected_at IS NULL`,
      [now, closedBy, sessionId, queueId],
    );
  }

  async findThreadCount(queueId: string): Promise<number | null> {
    const rows: Array<{ thread_count: number }> = await this.dataSource.query(
      'SELECT thread_count FROM dorify.dori_queue WHERE queue_id = $1 AND is_active = TRUE',
      [queueId],
    );
    return rows[0]?.thread_count ?? null;
  }

  async createSession(input: {
    queueId: string;
    userId: string;
    threadNumber: number | null;
    counterName: string | null;
    mode: 'active' | 'consultation_only';
    now: Date;
  }): Promise<QueueSessionRow> {
    const rows: QueueSessionRow[] = await this.dataSource.query(
      `INSERT INTO dorify.dori_operator_session
         (queue_id, user_id, thread_number, counter_name, mode, connected_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${SESSION_COLUMNS}`,
      [
        input.queueId,
        input.userId,
        input.threadNumber,
        input.counterName,
        input.mode,
        input.now,
      ],
    );
    return rows[0];
  }

  async findActiveUserSession(
    queueId: string,
    userId: string,
  ): Promise<Pick<
    QueueSessionRow,
    'session_id' | 'thread_number' | 'counter_name' | 'connected_at'
  > | null> {
    const rows = await this.dataSource.query(
      `SELECT session_id, thread_number, counter_name, connected_at
       FROM dorify.dori_operator_session
       WHERE queue_id = $1 AND user_id = $2
         AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, userId],
    );
    return rows[0] ?? null;
  }

  async findOccupiedThread(
    queueId: string,
    threadNumber: number,
  ): Promise<QueueSessionRow | null> {
    const rows: QueueSessionRow[] = await this.dataSource.query(
      `SELECT ${sessionColumns('qs')}, u.username FROM dorify.dori_operator_session qs
       JOIN dorify.dori_user u ON u.user_id = qs.user_id
       WHERE qs.queue_id = $1 AND qs.thread_number = $2
         AND qs.disconnected_at IS NULL`,
      [queueId, threadNumber],
    );
    return rows[0] ?? null;
  }

  takeOverThread(input: {
    queueId: string;
    threadNumber: number;
    counterName: string | null;
    userId: string;
    expectedPreviousSessionId?: string;
    now: Date;
  }): Promise<{
    session: QueueSessionRow;
    previousSessionId: string;
    reassignedRegistrationId: string | null;
  } | null> {
    return this.dataSource.transaction(async (manager) => {
      const locked: QueueSessionRow[] = await manager.query(
        `SELECT ${sessionColumns('qs')}, u.username FROM dorify.dori_operator_session qs
         JOIN dorify.dori_user u ON u.user_id = qs.user_id
         WHERE qs.queue_id = $1 AND qs.thread_number = $2
           AND qs.disconnected_at IS NULL
           AND ($3::uuid IS NULL OR qs.session_id = $3)
         FOR UPDATE OF qs`,
        [
          input.queueId,
          input.threadNumber,
          input.expectedPreviousSessionId ?? null,
        ],
      );
      if (!locked.length) return null;
      const previous = locked[0];
      await manager.query(
        `UPDATE dorify.dori_operator_session SET disconnected_at = $1,
         closure_reason = 'taken_over', closed_by_user_id = $2 WHERE session_id = $3`,
        [input.now, input.userId, previous.session_id],
      );
      const created: QueueSessionRow[] = await manager.query(
        `INSERT INTO dorify.dori_operator_session
           (queue_id, user_id, thread_number, counter_name, mode, connected_at, last_seen_at)
         VALUES ($1, $2, $3, $4, 'active', $5, $5) RETURNING ${SESSION_COLUMNS}`,
        [
          input.queueId,
          input.userId,
          input.threadNumber,
          input.counterName,
          input.now,
        ],
      );
      const clients: Array<{ registration_id: string }> = await manager.query(
        `SELECT registration_id FROM dorify.dori_registration
         WHERE served_by_session_id = $1 AND status = 'in_progress' AND is_active = TRUE
         FOR UPDATE`,
        [previous.session_id],
      );
      if (clients.length > 1) {
        throw new Error(
          'Multiple in-progress registrations found for one session',
        );
      }
      const reassignedRegistrationId = clients[0]?.registration_id ?? null;
      if (reassignedRegistrationId != null) {
        await manager.query(
          `UPDATE dorify.dori_registration SET served_by_session_id = $1,
           served_by_user_id = $2, updated_by_user_id = $2, updated_at = $3
           WHERE registration_id = $4`,
          [
            created[0].session_id,
            created[0].user_id,
            input.now,
            reassignedRegistrationId,
          ],
        );
      }
      return {
        session: created[0],
        previousSessionId: previous.session_id,
        reassignedRegistrationId,
      };
    });
  }

  async findInProgressRegistration(registrationId: string): Promise<{
    served_by_session_id: string;
    session_user_id: string;
    queue_id: string;
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT c.served_by_session_id, c.queue_id, qs.user_id AS session_user_id
       FROM dorify.dori_registration c JOIN dorify.dori_operator_session qs ON qs.session_id = c.served_by_session_id
       WHERE c.registration_id = $1 AND c.status = 'in_progress' AND c.is_active = TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async closeRegistration(
    registrationId: string,
    status: 'served' | 'no_show',
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (status === 'served') {
        await manager.query(
          `UPDATE dorify.dori_registration SET status = 'served', served_at = $1,
         closed_at = $1, updated_at = $1 WHERE registration_id = $2`,
          [now, registrationId],
        );
      } else {
        await manager.query(
          `UPDATE dorify.dori_registration SET status = 'no_show', closed_at = $1,
           updated_at = $1 WHERE registration_id = $2`,
          [now, registrationId],
        );
      }
      const rows: Array<{ queue_id: string }> = await manager.query(
        'SELECT queue_id FROM dorify.dori_registration WHERE registration_id = $1',
        [registrationId],
      );
      await enqueueRealtimeEvent(
        manager,
        rows[0].queue_id,
        'queue_display_changed',
        {
          queueId: rows[0].queue_id,
          reason:
            status === 'served'
              ? 'registration_served'
              : 'registration_no_show',
          timestamp: now.toISOString(),
        },
        now,
      );
    });
  }

  async recallRegistration(input: {
    registrationId: string;
    userId: string;
    now: Date;
  }): Promise<RecallRegistrationResult> {
    return this.dataSource.transaction(async (manager) => {
      const registrations: Array<{
        registration_id: string;
        queue_id: string;
        ticket_number: string;
        status: string;
        served_by_session_id: string | null;
      }> = await manager.query(
        `SELECT registration_id, queue_id, ticket_number, status, served_by_session_id
         FROM dorify.dori_registration
         WHERE registration_id = $1 AND is_active = TRUE
         FOR UPDATE`,
        [input.registrationId],
      );
      const registration = registrations[0];
      if (!registration) return { outcome: 'not_found' };
      if (registration.status !== 'in_progress') {
        return { outcome: 'not_in_progress' };
      }
      if (!registration.served_by_session_id) {
        return { outcome: 'session_unavailable' };
      }

      const sessions: Array<{
        session_id: string;
        user_id: string;
        thread_number: number;
        counter_name: string | null;
      }> = await manager.query(
        `SELECT session_id, user_id, thread_number, counter_name
         FROM dorify.dori_operator_session
         WHERE session_id = $1 AND queue_id = $2
           AND disconnected_at IS NULL AND mode = 'active'
         FOR UPDATE`,
        [registration.served_by_session_id, registration.queue_id],
      );
      const session = sessions[0];
      if (!session) return { outcome: 'session_unavailable' };
      if (session.user_id !== input.userId) return { outcome: 'forbidden' };

      const recalled: Array<{
        last_recalled_at: Date | string;
        recall_count: number;
      }> = await manager.query(
        `UPDATE dorify.dori_registration
         SET last_recalled_at = $1, recall_count = recall_count + 1,
             updated_by_user_id = $2, updated_at = $1
         WHERE registration_id = $3
         RETURNING last_recalled_at, recall_count`,
        [input.now, input.userId, input.registrationId],
      );

      await enqueueRealtimeEvent(
        manager,
        registration.queue_id,
        'queue_display_changed',
        {
          queueId: registration.queue_id,
          reason: 'registration_recalled',
          registrationId: registration.registration_id,
          timestamp: input.now.toISOString(),
        },
        input.now,
      );

      return {
        outcome: 'recalled',
        registration_id: registration.registration_id,
        queue_id: registration.queue_id,
        ticket_number: registration.ticket_number,
        status: 'in_progress',
        session_id: session.session_id,
        thread_number: session.thread_number,
        counter_name: session.counter_name,
        last_recalled_at: recalled[0].last_recalled_at,
        recall_count: Number(recalled[0].recall_count),
      };
    });
  }

  async findSessionPage(input: {
    queueId: string;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }): Promise<{ items: QueueSessionRow[]; total: number }> {
    const from = `FROM dorify.dori_operator_session qs JOIN dorify.dori_user u ON u.user_id = qs.user_id
      WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL`;
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int as total ${from}`,
      [input.queueId],
    );
    const items: QueueSessionRow[] = await this.dataSource.query(
      `SELECT qs.session_id, qs.queue_id, qs.thread_number, qs.counter_name, qs.user_id,
              u.username, qs.mode, qs.connected_at, qs.disconnected_at ${from}
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $2 OFFSET $3`,
      [input.queueId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findCallContext(
    queueId: string,
    userId: string,
  ): Promise<{
    session: QueueSessionRow | null;
    config: {
      baseWalkin: number;
      baseAppointment: number;
      rateWalkin: number;
      rateAppointment: number;
      timezone: string;
    } | null;
  }> {
    const sessions: QueueSessionRow[] = await this.dataSource.query(
      `SELECT ${SESSION_COLUMNS} FROM dorify.dori_operator_session WHERE queue_id = $1 AND user_id = $2
       AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, userId],
    );
    const configs = await this.dataSource.query(
      `SELECT q.base_weight_walkin, q.base_weight_appointment,
              q.escalation_rate_walkin, q.escalation_rate_appointment,
              s.default_base_weight_walkin, s.default_base_weight_appointment,
              s.default_escalation_rate_walkin, s.default_escalation_rate_appointment,
              s.timezone FROM dorify.dori_queue q
       JOIN dorify.dori_site s ON s.site_id = q.site_id WHERE q.queue_id = $1`,
      [queueId],
    );
    const cfg = configs[0];
    return {
      session: sessions[0] ?? null,
      config: cfg
        ? {
            baseWalkin: Number(
              cfg.base_weight_walkin ?? cfg.default_base_weight_walkin ?? 0,
            ),
            baseAppointment: Number(
              cfg.base_weight_appointment ??
                cfg.default_base_weight_appointment ??
                60,
            ),
            rateWalkin: Number(
              cfg.escalation_rate_walkin ??
                cfg.default_escalation_rate_walkin ??
                1,
            ),
            rateAppointment: Number(
              cfg.escalation_rate_appointment ??
                cfg.default_escalation_rate_appointment ??
                1,
            ),
            timezone: cfg.timezone || 'Africa/Tunis',
          }
        : null,
    };
  }

  callNext(input: {
    queueId: string;
    sessionId: string;
    userId: string;
    businessDate: string;
    now: Date;
    baseWalkin: number;
    baseAppointment: number;
    rateWalkin: number;
    rateAppointment: number;
  }): Promise<NextCandidateRow | null> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, 0))",
        ['daily-reset', input.queueId],
      );
      const activeSession: Array<{ session_id: string }> = await manager.query(
        `SELECT session_id FROM dorify.dori_operator_session
         WHERE session_id = $1 AND queue_id = $2 AND user_id = $3
           AND disconnected_at IS NULL AND mode = 'active' FOR UPDATE`,
        [input.sessionId, input.queueId, input.userId],
      );
      if (!activeSession.length) return null;

      let selected: Array<{ registration_id: string; score: number }> =
        await manager.query(
          `WITH eligible AS (
             SELECT c.registration_id,
               ROUND((CASE WHEN c.entry_type = 'appointment'
                 THEN $1 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $2
                 ELSE $3 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $4
               END)::numeric, 2) AS score
             FROM dorify.dori_registration c WHERE c.queue_id = $5
               AND c.business_date = $6::date AND c.status = 'waiting' AND c.is_active = TRUE
               AND (c.entry_type = 'walkin' OR
                 (c.appointment_status = 'checked_in' AND c.scheduled_time <= $7))
           ) SELECT registration_id, score FROM eligible ORDER BY score DESC
             FOR UPDATE SKIP LOCKED LIMIT 1`,
          [
            input.baseAppointment,
            input.rateAppointment,
            input.baseWalkin,
            input.rateWalkin,
            input.queueId,
            input.businessDate,
            input.now,
          ],
        );
      let calledEarly = false;
      if (!selected.length) {
        selected = await manager.query(
          `SELECT registration_id, 0 AS score FROM dorify.dori_registration
           WHERE queue_id = $1 AND business_date = $2::date AND status = 'waiting'
             AND is_active = TRUE AND appointment_status = 'checked_in'
             AND scheduled_time > $3 ORDER BY scheduled_time ASC
             FOR UPDATE SKIP LOCKED LIMIT 1`,
          [input.queueId, input.businessDate, input.now],
        );
        calledEarly = selected.length > 0;
      }
      if (!selected.length) return null;
      const candidate = selected[0];
      await manager.query(
        `UPDATE dorify.dori_registration SET status = 'in_progress', served_by_session_id = $1,
         served_by_user_id = $2, called_at = $3, updated_at = $3
         WHERE registration_id = $4`,
        [input.sessionId, input.userId, input.now, candidate.registration_id],
      );
      const details: NextCandidateRow[] = await manager.query(
        `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
                c.status, c.called_at, c.registration_tracking_token,
                t.tier_id, t.tier_code, t.tier_name,
                p.person_id, p.first_name, p.last_name, p.phone_number,
                (SELECT COUNT(*)::int FROM dorify.dori_person_note n
                 WHERE n.person_id = p.person_id AND n.is_active = TRUE) AS notes_count
         FROM dorify.dori_registration c JOIN dorify.dori_service_tier t ON t.tier_id = c.tier_id
         JOIN dorify.dori_person p ON p.person_id = c.person_id WHERE c.registration_id = $1`,
        [candidate.registration_id],
      );
      await enqueueRealtimeEvent(
        manager,
        input.queueId,
        'queue_display_changed',
        {
          queueId: input.queueId,
          reason: 'registration_called',
          timestamp: input.now.toISOString(),
        },
        input.now,
      );
      await enqueueRealtimeEvent(
        manager,
        input.queueId,
        'queue_position_changed',
        {
          queueId: input.queueId,
          timestamp: input.now.toISOString(),
        },
        input.now,
      );
      return Object.assign(details[0], {
        score: Number(candidate.score || 0),
        called_early: calledEarly,
      });
    });
  }

  callNextForSite(input: {
    siteId: string;
    userId: string;
    allowedQueueIds: string[] | null;
    now: Date;
  }): Promise<SiteCallNextResult> {
    return this.dataSource.transaction(async (manager) => {
      const sessions: Array<{
        session_id: string;
        queue_id: string;
      }> = await manager.query(
        `SELECT os.session_id, os.queue_id
         FROM dorify.dori_operator_session os
         JOIN dorify.dori_queue q ON q.queue_id = os.queue_id
         WHERE q.site_id = $1 AND q.is_active = TRUE
           AND os.user_id = $2 AND os.disconnected_at IS NULL
           AND os.mode = 'active'
           AND ($3::uuid[] IS NULL OR os.queue_id = ANY($3::uuid[]))
           AND NOT EXISTS (
             SELECT 1 FROM dorify.dori_registration active_registration
             WHERE active_registration.served_by_session_id = os.session_id
               AND active_registration.status = 'in_progress'
               AND active_registration.is_active = TRUE
           )
         ORDER BY os.queue_id
         FOR UPDATE OF os`,
        [input.siteId, input.userId, input.allowedQueueIds],
      );
      if (!sessions.length) return { outcome: 'no_session' };

      const queueIds = sessions.map((session) => session.queue_id);
      await manager.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended('daily-reset:' || queue_id::text, 0)
         )
         FROM unnest($1::uuid[]) AS queue_id
         ORDER BY queue_id`,
        [queueIds],
      );

      let selected: Array<{
        registration_id: string;
        queue_id: string;
        session_id: string;
        score: number;
      }> = await manager.query(
        `SELECT c.registration_id, c.queue_id, os.session_id,
                ROUND((CASE WHEN c.entry_type = 'appointment'
                  THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                    + EXTRACT(EPOCH FROM ($3 - c.priority_reference_time))/60
                      * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
                  ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                    + EXTRACT(EPOCH FROM ($3 - c.priority_reference_time))/60
                      * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
                END)::numeric, 2) AS score
         FROM dorify.dori_registration c
         JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
         JOIN dorify.dori_site s ON s.site_id = q.site_id
         JOIN dorify.dori_operator_session os
           ON os.queue_id = c.queue_id AND os.user_id = $2
          AND os.disconnected_at IS NULL AND os.mode = 'active'
         WHERE q.site_id = $1 AND c.queue_id = ANY($4::uuid[])
           AND c.business_date = ($3::timestamptz AT TIME ZONE s.timezone)::date
           AND c.status = 'waiting' AND c.is_active = TRUE
           AND (c.entry_type = 'walkin' OR
             (c.appointment_status = 'checked_in' AND c.scheduled_time <= $3))
         ORDER BY score DESC, c.priority_reference_time ASC, c.registration_id ASC
         FOR UPDATE OF c SKIP LOCKED LIMIT 1`,
        [input.siteId, input.userId, input.now, queueIds],
      );
      let calledEarly = false;
      if (!selected.length) {
        selected = await manager.query(
          `SELECT c.registration_id, c.queue_id, os.session_id, 0 AS score
           FROM dorify.dori_registration c
           JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
           JOIN dorify.dori_site s ON s.site_id = q.site_id
           JOIN dorify.dori_operator_session os
             ON os.queue_id = c.queue_id AND os.user_id = $2
            AND os.disconnected_at IS NULL AND os.mode = 'active'
           WHERE q.site_id = $1 AND c.queue_id = ANY($4::uuid[])
             AND c.business_date = ($3::timestamptz AT TIME ZONE s.timezone)::date
             AND c.status = 'waiting' AND c.is_active = TRUE
             AND c.entry_type = 'appointment'
             AND c.appointment_status = 'checked_in' AND c.scheduled_time > $3
           ORDER BY c.scheduled_time ASC, c.registration_id ASC
           FOR UPDATE OF c SKIP LOCKED LIMIT 1`,
          [input.siteId, input.userId, input.now, queueIds],
        );
        calledEarly = selected.length > 0;
      }
      if (!selected.length) return { outcome: 'empty' };

      const candidate = selected[0];
      await manager.query(
        `UPDATE dorify.dori_registration
         SET status = 'in_progress', served_by_session_id = $1,
             served_by_user_id = $2, called_at = $3, updated_at = $3
         WHERE registration_id = $4`,
        [
          candidate.session_id,
          input.userId,
          input.now,
          candidate.registration_id,
        ],
      );
      const details: SiteNextCandidateRow[] = await manager.query(
        `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
                c.status, c.called_at, c.registration_tracking_token,
                c.queue_id, q.queue_name, os.session_id, os.thread_number,
                t.tier_id, t.tier_code, t.tier_name,
                p.person_id, p.first_name, p.last_name, p.phone_number,
                (SELECT COUNT(*)::int FROM dorify.dori_person_note n
                 WHERE n.person_id = p.person_id AND n.is_active = TRUE) AS notes_count
         FROM dorify.dori_registration c
         JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
         JOIN dorify.dori_operator_session os ON os.session_id = c.served_by_session_id
         JOIN dorify.dori_service_tier t ON t.tier_id = c.tier_id
         JOIN dorify.dori_person p ON p.person_id = c.person_id
         WHERE c.registration_id = $1`,
        [candidate.registration_id],
      );
      await enqueueRealtimeEvent(
        manager,
        candidate.queue_id,
        'queue_display_changed',
        {
          queueId: candidate.queue_id,
          reason: 'registration_called',
          timestamp: input.now.toISOString(),
        },
        input.now,
      );
      await enqueueRealtimeEvent(
        manager,
        candidate.queue_id,
        'queue_position_changed',
        { queueId: candidate.queue_id, timestamp: input.now.toISOString() },
        input.now,
      );
      return {
        outcome: 'called',
        candidate: Object.assign(details[0], {
          score: Number(candidate.score || 0),
          called_early: calledEarly,
        }),
      };
    });
  }

  async findQueueIds(siteId?: string): Promise<string[]> {
    const rows: Array<{ queue_id: string }> = await this.dataSource.query(
      siteId === undefined
        ? 'SELECT queue_id FROM dorify.dori_queue WHERE is_active = TRUE'
        : 'SELECT queue_id FROM dorify.dori_queue WHERE site_id = $1 AND is_active = TRUE',
      siteId === undefined ? [] : [siteId],
    );
    return rows.map((row) => String(row.queue_id));
  }

  getCockpitData(input: {
    siteId: string;
    queueIds: string[];
    userId: string;
    now: Date;
    previewLimit: number;
    recentLimit: number;
  }): Promise<CockpitData> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const sites = await manager.query(
        `SELECT site_id, site_name, timezone
         FROM dorify.dori_site
         WHERE site_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [input.siteId],
      );
      const operators = await manager.query(
        `SELECT user_id, username, full_name
         FROM dorify.dori_user
         WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [input.userId],
      );
      if (!sites.length || !input.queueIds.length) {
        return {
          site: sites[0] ?? null,
          operator: operators[0] ?? null,
          queues: [],
          sessions: [],
          activeCalls: [],
          candidates: [],
          recentPassages: [],
        };
      }

      const queues = await manager.query(
        `SELECT q.queue_id, q.queue_code, q.queue_name, q.thread_count,
                q.average_wait_time,
                COUNT(DISTINCT r.registration_id) FILTER (
                  WHERE r.status = 'waiting'
                )::int AS waiting_count,
                COUNT(DISTINCT r.registration_id) FILTER (
                  WHERE r.entry_type = 'appointment'
                    AND r.status IN ('booked', 'waiting')
                    AND r.appointment_status NOT IN ('cancelled', 'expired')
                )::int AS remaining_appointments_count,
                COUNT(DISTINCT os.session_id)::int AS occupied_threads_count,
                stat.cycle_p50_minutes
         FROM dorify.dori_queue q
         JOIN dorify.dori_site s ON s.site_id = q.site_id
         LEFT JOIN dorify.dori_registration r
           ON r.queue_id = q.queue_id AND r.is_active = TRUE
          AND r.business_date = ($3::timestamptz AT TIME ZONE s.timezone)::date
         LEFT JOIN dorify.dori_operator_session os
           ON os.queue_id = q.queue_id AND os.disconnected_at IS NULL
          AND os.mode = 'active'
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
         GROUP BY q.queue_id, q.queue_code, q.queue_name, q.thread_count,
                  q.average_wait_time, stat.cycle_p50_minutes
         ORDER BY q.queue_name ASC, q.queue_id ASC`,
        [input.siteId, input.queueIds, input.now],
      );
      const sessions = await manager.query(
        `SELECT os.session_id, os.queue_id, os.user_id, os.thread_number,
                os.counter_name, COALESCE(u.full_name, u.username) AS operator_name
         FROM dorify.dori_operator_session os
         JOIN dorify.dori_user u ON u.user_id = os.user_id
         WHERE os.queue_id = ANY($1::uuid[])
           AND os.disconnected_at IS NULL AND os.mode = 'active'
         ORDER BY os.queue_id, os.thread_number`,
        [input.queueIds],
      );
      const activeCalls = await manager.query(
        `SELECT r.registration_id, r.queue_id, r.ticket_number, r.status,
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
        [input.queueIds, input.userId],
      );
      const candidates =
        input.previewLimit === 0
          ? []
          : await manager.query(
              `WITH ranked AS (
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
              [input.queueIds, input.now, input.previewLimit],
            );
      const recentPassages =
        input.recentLimit === 0
          ? []
          : await manager.query(
              `SELECT r.registration_id, r.queue_id, q.queue_name,
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
              [input.queueIds, input.userId, input.recentLimit],
            );
      return {
        site: sites[0],
        operator: operators[0] ?? null,
        queues,
        sessions,
        activeCalls,
        candidates,
        recentPassages,
      };
    });
  }

  async findActiveQueueIdsForUser(
    queueIds: string[],
    userId: string,
  ): Promise<string[]> {
    const rows: Array<{ queue_id: string }> = await this.dataSource.query(
      `SELECT DISTINCT queue_id FROM dorify.dori_operator_session
       WHERE queue_id = ANY($1::uuid[]) AND user_id = $2
         AND disconnected_at IS NULL AND mode = 'active'`,
      [queueIds, userId],
    );
    return rows.map((row) => String(row.queue_id));
  }

  async findPreviewCandidates(
    queueIds: string[],
    now: Date,
    limit: number,
  ): Promise<PreviewCandidateRow[]> {
    const eligible: PreviewCandidateRow[] = await this.dataSource.query(
      `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
              c.queue_id, q.queue_code, q.queue_name, s.site_name,
              p.person_id, p.first_name, p.last_name,
              ROUND((CASE WHEN c.entry_type = 'appointment'
                THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                  + EXTRACT(EPOCH FROM ($2 - c.priority_reference_time))/60
                    * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
                ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                  + EXTRACT(EPOCH FROM ($2 - c.priority_reference_time))/60
                    * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
              END)::numeric, 2) AS score, FALSE AS called_early
       FROM dorify.dori_registration c JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
       JOIN dorify.dori_site s ON s.site_id = q.site_id JOIN dorify.dori_person p ON p.person_id = c.person_id
       WHERE c.queue_id = ANY($1::uuid[]) AND c.status = 'waiting' AND c.is_active = TRUE
         AND c.business_date = ($2::timestamptz AT TIME ZONE s.timezone)::date
         AND (c.entry_type = 'walkin' OR
           (c.appointment_status = 'checked_in' AND c.scheduled_time <= $2))
       ORDER BY score DESC, c.registration_id ASC LIMIT $3`,
      [queueIds, now, limit],
    );
    if (eligible.length >= limit) return eligible;
    const queueIdsWithEligibleCandidate = eligible.map((row) => row.queue_id);
    const early: PreviewCandidateRow[] = await this.dataSource.query(
      `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
              c.queue_id, q.queue_code, q.queue_name, s.site_name,
              p.person_id, p.first_name, p.last_name, 0 AS score, TRUE AS called_early
       FROM dorify.dori_registration c JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
       JOIN dorify.dori_site s ON s.site_id = q.site_id JOIN dorify.dori_person p ON p.person_id = c.person_id
       WHERE c.queue_id = ANY($1::uuid[]) AND c.status = 'waiting' AND c.is_active = TRUE
         AND c.business_date = ($2::timestamptz AT TIME ZONE s.timezone)::date
         AND c.entry_type = 'appointment' AND c.appointment_status = 'checked_in'
         AND c.scheduled_time > $2 AND c.queue_id <> ALL($3::uuid[])
       ORDER BY c.scheduled_time ASC, c.registration_id ASC LIMIT $4`,
      [queueIds, now, queueIdsWithEligibleCandidate, limit - eligible.length],
    );
    return [...eligible, ...early];
  }
}
