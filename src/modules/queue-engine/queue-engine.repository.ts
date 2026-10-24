import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
           AND qs.disconnected_at IS NULL FOR UPDATE OF qs`,
        [input.queueId, input.threadNumber],
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
         WHERE served_by_session_id = $1 AND status = 'in_progress' AND is_active = TRUE`,
        [previous.session_id],
      );
      const reassignedRegistrationId = clients[0]?.registration_id ?? null;
      if (reassignedRegistrationId != null) {
        await manager.query(
          `UPDATE dorify.dori_registration SET served_by_session_id = $1,
           served_by_user_id = $2, updated_at = $3
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
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT c.served_by_session_id, qs.user_id AS session_user_id
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
    if (status === 'served') {
      await this.dataSource.query(
        `UPDATE dorify.dori_registration SET status = 'served', served_at = $1,
         closed_at = $1, updated_at = $1 WHERE registration_id = $2`,
        [now, registrationId],
      );
      return;
    }
    await this.dataSource.query(
      `UPDATE dorify.dori_registration SET status = 'no_show', closed_at = $1,
       updated_at = $1 WHERE registration_id = $2`,
      [now, registrationId],
    );
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
      return Object.assign(details[0], {
        score: Number(candidate.score || 0),
        called_early: calledEarly,
      });
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
