import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ActiveThreadSessionRow {
  session_id: number;
  user_id: number;
  thread_number: number;
  username: string;
  connected_at: Date | string;
  last_seen_at: Date | string;
  current_registration_id: number | null;
}

export interface QueueSessionRow extends Record<string, unknown> {
  session_id: number;
  queue_id: number;
  user_id: number;
  thread_number: number | null;
  mode: 'active' | 'consultation_only';
  connected_at: Date | string;
  last_seen_at: Date | string;
  username?: string;
}

export interface NextCandidateRow extends Record<string, unknown> {
  registration_id: number;
  ticket_number: string;
  entry_type: 'walkin' | 'appointment';
  scheduled_time: string | null;
  status: string;
  called_at: string;
  registration_tracking_token: string;
  tier_id: number;
  tier_code: string;
  tier_name: string;
  person_id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  notes_count: number;
  score: number;
  called_early: boolean;
}

export interface PreviewCandidateRow extends Record<string, unknown> {
  registration_id: number;
  ticket_number: string;
  entry_type: 'walkin' | 'appointment';
  scheduled_time: string | null;
  queue_id: number;
  queue_code: string;
  queue_name: string;
  site_name: string;
  person_id: number;
  first_name: string;
  last_name: string;
  score?: number;
  called_early: boolean;
}

@Injectable()
export class QueueEngineRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findThreadState(queueId: number): Promise<{
    threadCount: number;
    sessions: ActiveThreadSessionRow[];
  } | null> {
    const queues: Array<{ thread_count: number }> = await this.dataSource.query(
      'SELECT thread_count FROM dori_site_queue_thread WHERE queue_id = $1 AND is_active = TRUE',
      [queueId],
    );
    if (!queues.length) return null;
    const sessions: ActiveThreadSessionRow[] = await this.dataSource.query(
      `SELECT qs.*, u.username, c.registration_id AS current_registration_id
       FROM dori_queue_session qs JOIN dori_user u ON u.user_id = qs.user_id
       LEFT JOIN dori_registration c ON c.current_session_id = qs.session_id
         AND c.status = 'in_progress' AND c.is_active = TRUE
       WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL AND qs.mode = 'active'`,
      [queueId],
    );
    return { threadCount: queues[0].thread_count || 1, sessions };
  }

  async closeSession(
    queueId: number,
    sessionId: number,
    closedBy: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dori_queue_session SET disconnected_at = $1,
       closure_reason = 'logout', closed_by_user_id = $2
       WHERE session_id = $3 AND queue_id = $4 AND disconnected_at IS NULL`,
      [now, closedBy, sessionId, queueId],
    );
  }

  async findThreadCount(queueId: number): Promise<number | null> {
    const rows: Array<{ thread_count: number }> = await this.dataSource.query(
      'SELECT thread_count FROM dori_site_queue_thread WHERE queue_id = $1 AND is_active = TRUE',
      [queueId],
    );
    return rows[0]?.thread_count ?? null;
  }

  async createSession(input: {
    queueId: number;
    userId: number;
    threadNumber: number | null;
    mode: 'active' | 'consultation_only';
    now: Date;
  }): Promise<QueueSessionRow> {
    const rows: QueueSessionRow[] = await this.dataSource.query(
      `INSERT INTO dori_queue_session
         (queue_id, user_id, thread_number, mode, connected_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [input.queueId, input.userId, input.threadNumber, input.mode, input.now],
    );
    return rows[0];
  }

  async findActiveUserSession(
    queueId: number,
    userId: number,
  ): Promise<Pick<QueueSessionRow, 'session_id' | 'thread_number'> | null> {
    const rows = await this.dataSource.query(
      `SELECT session_id, thread_number FROM dori_queue_session
       WHERE queue_id = $1 AND user_id = $2
         AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, userId],
    );
    return rows[0] ?? null;
  }

  async findOccupiedThread(
    queueId: number,
    threadNumber: number,
  ): Promise<QueueSessionRow | null> {
    const rows: QueueSessionRow[] = await this.dataSource.query(
      `SELECT qs.*, u.username FROM dori_queue_session qs
       JOIN dori_user u ON u.user_id = qs.user_id
       WHERE qs.queue_id = $1 AND qs.thread_number = $2
         AND qs.disconnected_at IS NULL`,
      [queueId, threadNumber],
    );
    return rows[0] ?? null;
  }

  takeOverThread(input: {
    queueId: number;
    threadNumber: number;
    userId: number;
    now: Date;
  }): Promise<{
    session: QueueSessionRow;
    previousSessionId: number;
    reassignedRegistrationId: number | null;
  } | null> {
    return this.dataSource.transaction(async (manager) => {
      const locked: QueueSessionRow[] = await manager.query(
        `SELECT qs.*, u.username FROM dori_queue_session qs
         JOIN dori_user u ON u.user_id = qs.user_id
         WHERE qs.queue_id = $1 AND qs.thread_number = $2
           AND qs.disconnected_at IS NULL FOR UPDATE OF qs`,
        [input.queueId, input.threadNumber],
      );
      if (!locked.length) return null;
      const previous = locked[0];
      await manager.query(
        `UPDATE dori_queue_session SET disconnected_at = $1,
         closure_reason = 'taken_over', closed_by_user_id = $2 WHERE session_id = $3`,
        [input.now, input.userId, previous.session_id],
      );
      const created: QueueSessionRow[] = await manager.query(
        `INSERT INTO dori_queue_session
           (queue_id, user_id, thread_number, mode, connected_at, last_seen_at)
         VALUES ($1, $2, $3, 'active', $4, $4) RETURNING *`,
        [input.queueId, input.userId, input.threadNumber, input.now],
      );
      const clients: Array<{ registration_id: number }> = await manager.query(
        `SELECT registration_id FROM dori_registration
         WHERE current_session_id = $1 AND status = 'in_progress' AND is_active = TRUE`,
        [previous.session_id],
      );
      const reassignedRegistrationId = clients[0]?.registration_id ?? null;
      if (reassignedRegistrationId != null) {
        await manager.query(
          `UPDATE dori_registration SET current_session_id = $1, updated_at = $2
           WHERE registration_id = $3`,
          [created[0].session_id, input.now, reassignedRegistrationId],
        );
      }
      return {
        session: created[0],
        previousSessionId: previous.session_id,
        reassignedRegistrationId,
      };
    });
  }

  async findInProgressRegistration(registrationId: number): Promise<{
    current_session_id: number;
    session_user_id: number;
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT c.current_session_id, qs.user_id AS session_user_id
       FROM dori_registration c JOIN dori_queue_session qs ON qs.session_id = c.current_session_id
       WHERE c.registration_id = $1 AND c.status = 'in_progress' AND c.is_active = TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async closeRegistration(
    registrationId: number,
    status: 'served' | 'no_show',
    now: Date,
  ): Promise<void> {
    if (status === 'served') {
      await this.dataSource.query(
        `UPDATE dori_registration SET status = 'served', served_at = $1,
         closed_at = $1, updated_at = $1 WHERE registration_id = $2`,
        [now, registrationId],
      );
      return;
    }
    await this.dataSource.query(
      `UPDATE dori_registration SET status = 'no_show', closed_at = $1,
       is_active = FALSE, updated_at = $1 WHERE registration_id = $2`,
      [now, registrationId],
    );
  }

  async findSessionPage(input: {
    queueId: number;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }): Promise<{ items: QueueSessionRow[]; total: number }> {
    const from = `FROM dori_queue_session qs JOIN dori_user u ON u.user_id = qs.user_id
      WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL`;
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int as total ${from}`,
      [input.queueId],
    );
    const items: QueueSessionRow[] = await this.dataSource.query(
      `SELECT qs.session_id, qs.queue_id, qs.thread_number, qs.user_id,
              u.username, qs.mode, qs.connected_at, qs.disconnected_at ${from}
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $2 OFFSET $3`,
      [input.queueId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findCallContext(
    queueId: number,
    userId: number,
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
      `SELECT * FROM dori_queue_session WHERE queue_id = $1 AND user_id = $2
       AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, userId],
    );
    const configs = await this.dataSource.query(
      `SELECT q.base_weight_walkin, q.base_weight_appointment,
              q.escalation_rate_walkin, q.escalation_rate_appointment,
              s.default_base_weight_walkin, s.default_base_weight_appointment,
              s.default_escalation_rate_walkin, s.default_escalation_rate_appointment,
              s.timezone FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id WHERE q.queue_id = $1`,
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
    queueId: number;
    sessionId: number;
    businessDate: string;
    now: Date;
    baseWalkin: number;
    baseAppointment: number;
    rateWalkin: number;
    rateAppointment: number;
  }): Promise<NextCandidateRow | null> {
    return this.dataSource.transaction(async (manager) => {
      let selected: Array<{ registration_id: number; score: number }> =
        await manager.query(
          `WITH eligible AS (
             SELECT c.registration_id,
               ROUND((CASE WHEN c.entry_type = 'appointment'
                 THEN $1 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $2
                 ELSE $3 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $4
               END)::numeric, 2) AS score
             FROM dori_registration c WHERE c.queue_id = $5
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
          `SELECT registration_id, 0 AS score FROM dori_registration
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
        `UPDATE dori_registration SET status = 'in_progress', current_session_id = $1,
         called_at = $2, updated_at = $2 WHERE registration_id = $3`,
        [input.sessionId, input.now, candidate.registration_id],
      );
      const details: NextCandidateRow[] = await manager.query(
        `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
                c.status, c.called_at, c.registration_tracking_token,
                t.tier_id, t.tier_code, t.tier_name,
                p.person_id, p.first_name, p.last_name, p.phone_number,
                (SELECT COUNT(*)::int FROM dori_person_note n
                 WHERE n.person_id = p.person_id AND n.is_active = TRUE) AS notes_count
         FROM dori_registration c JOIN dori_service_tier t ON t.tier_id = c.tier_id
         JOIN dori_person p ON p.person_id = c.person_id WHERE c.registration_id = $1`,
        [candidate.registration_id],
      );
      return Object.assign(details[0], {
        score: Number(candidate.score || 0),
        called_early: calledEarly,
      });
    });
  }

  async findQueueIds(siteId?: number): Promise<number[]> {
    const rows: Array<{ queue_id: number }> = await this.dataSource.query(
      siteId === undefined
        ? 'SELECT queue_id FROM dori_site_queue_thread WHERE is_active = TRUE'
        : 'SELECT queue_id FROM dori_site_queue_thread WHERE site_id = $1 AND is_active = TRUE',
      siteId === undefined ? [] : [siteId],
    );
    return rows.map((row) => Number(row.queue_id));
  }

  async findPreviewCandidates(
    queueIds: number[],
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
       FROM dori_registration c JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id JOIN dori_person p ON p.person_id = c.person_id
       WHERE c.queue_id = ANY($1::int[]) AND c.status = 'waiting' AND c.is_active = TRUE
         AND (c.entry_type = 'walkin' OR
           (c.appointment_status = 'checked_in' AND c.scheduled_time <= $2))
       ORDER BY score DESC LIMIT $3`,
      [queueIds, now, limit],
    );
    if (eligible.length >= limit) return eligible;
    const ids = eligible.map((row) => row.registration_id);
    const early: PreviewCandidateRow[] = await this.dataSource.query(
      `SELECT c.registration_id, c.ticket_number, c.entry_type, c.scheduled_time,
              c.queue_id, q.queue_code, q.queue_name, s.site_name,
              p.person_id, p.first_name, p.last_name, 0 AS score, TRUE AS called_early
       FROM dori_registration c JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id JOIN dori_person p ON p.person_id = c.person_id
       WHERE c.queue_id = ANY($1::int[]) AND c.status = 'waiting' AND c.is_active = TRUE
         AND c.entry_type = 'appointment' AND c.appointment_status = 'checked_in'
         AND c.scheduled_time > $2 AND c.registration_id <> ALL($3::int[])
       ORDER BY c.scheduled_time ASC LIMIT $4`,
      [queueIds, now, ids, limit - eligible.length],
    );
    return [...eligible, ...early];
  }
}
