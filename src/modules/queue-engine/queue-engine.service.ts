import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OpenSessionDto } from './dto/session.dto';
import { QueueSessionDetailDto } from './dto/engine-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { RealtimeService } from '../../core/realtime/realtime.service';

@Injectable()
export class QueueEngineService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly realtimeService: RealtimeService,
  ) {}

  // 1. Threads State (§6.1)
  async getThreads(
    queueId: number,
    user: AuthenticatedUser,
    pagination: PaginationDto = new PaginationDto(),
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const queueRes = await this.dataSource.query(
      `SELECT thread_count FROM dori_site_queue_thread WHERE queue_id = $1 AND is_active = TRUE`,
      [queueId],
    );

    if (!queueRes || queueRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const threadCount = queueRes[0].thread_count || 1;
    const now = this.clockService.now();

    // Fetch active sessions on this queue
    const activeSessions = await this.dataSource.query(
      `SELECT qs.*, u.username,
              c.customer_id as current_registration_id
       FROM dori_queue_session qs
       JOIN dori_user u ON u.user_id = qs.user_id
       LEFT JOIN dori_customer c ON c.current_session_id = qs.session_id AND c.status = 'in_progress' AND c.is_active = TRUE
       WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL AND qs.mode = 'active'`,
      [queueId],
    );

    const sessionByThread = new Map<number, any>();
    for (const s of activeSessions) {
      if (s.thread_number) {
        sessionByThread.set(s.thread_number, s);
      }
    }

    const items: any[] = [];
    for (let t = 1; t <= threadCount; t++) {
      const s = sessionByThread.get(t);
      if (s) {
        const lastSeen = this.clockService.parse(s.last_seen_at);
        const inactiveMinutes = Math.max(
          0,
          Math.floor((now.getTime() - lastSeen.getTime()) / 60000),
        );
        items.push({
          threadNumber: t,
          status: 'occupied',
          session: {
            sessionId: s.session_id,
            userId: s.user_id,
            username: s.username,
            connectedAt: s.connected_at,
            lastSeenAt: s.last_seen_at,
            inactiveMinutes,
            currentRegistrationId: s.current_registration_id || null,
          },
        });
      } else {
        items.push({
          threadNumber: t,
          status: 'free',
          session: null,
        });
      }
    }

    const { offset, pageSize } = pagination.getParams();
    return pagination.createResponse(
      items.slice(offset, offset + pageSize),
      items.length,
    );
  }

  // 2. Open or Take Over Session (§6.2, §4.6)
  async openSession(
    queueId: number,
    dto: OpenSessionDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();
    const mode = dto.mode || 'active';

    if (mode === 'consultation_only') {
      let res: any[];
      try {
        res = await this.dataSource.query(
          `INSERT INTO dori_queue_session (queue_id, user_id, thread_number, mode, connected_at, last_seen_at)
           VALUES ($1, $2, NULL, 'consultation_only', $3, $3)
           RETURNING *`,
          [queueId, user.userId, now],
        );
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new DoriException('SESSION_ALREADY_OPEN');
        }
        throw error;
      }
      const session = res[0];
      return {
        sessionId: session.session_id,
        queueId: session.queue_id,
        userId: session.user_id,
        threadNumber: null,
        mode: 'consultation_only',
        connectedAt: session.connected_at,
      };
    }

    // mode === 'active'
    if (!dto.threadNumber) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['threadNumber is required for active mode'] },
      );
    }

    const queueRes = await this.dataSource.query(
      `SELECT thread_count FROM dori_site_queue_thread WHERE queue_id = $1 AND is_active = TRUE`,
      [queueId],
    );
    if (!queueRes || queueRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    if (dto.threadNumber < 1 || dto.threadNumber > queueRes[0].thread_count) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            `threadNumber must be between 1 and ${queueRes[0].thread_count}`,
          ],
        },
      );
    }

    // Check if current user already has an active session on this queue (§3.9, §6.9)
    const existingUserSession = await this.dataSource.query(
      `SELECT session_id, thread_number FROM dori_queue_session
       WHERE queue_id = $1 AND user_id = $2 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, user.userId],
    );

    if (existingUserSession && existingUserSession.length > 0) {
      // If user is already on the exact same thread requested, return existing session
      if (existingUserSession[0].thread_number === dto.threadNumber) {
        return {
          sessionId: existingUserSession[0].session_id,
          queueId,
          userId: user.userId,
          threadNumber: dto.threadNumber,
          mode: 'active',
          connectedAt: now,
          takenOverFromSessionId: null,
          reassignedRegistrationId: null,
        };
      }
      throw new DoriException('SESSION_ALREADY_OPEN');
    }

    // Check if thread is currently occupied
    const occupiedRows = await this.dataSource.query(
      `SELECT qs.*, u.username
       FROM dori_queue_session qs
       JOIN dori_user u ON u.user_id = qs.user_id
       WHERE qs.queue_id = $1 AND qs.thread_number = $2 AND qs.disconnected_at IS NULL`,
      [queueId, dto.threadNumber],
    );

    if (occupiedRows && occupiedRows.length > 0) {
      const occupied = occupiedRows[0];
      if (!dto.takeOver) {
        const lastSeen = this.clockService.parse(occupied.last_seen_at);
        const inactiveMinutes = Math.max(
          0,
          Math.floor((now.getTime() - lastSeen.getTime()) / 60000),
        );
        throw new DoriException('THREAD_OCCUPIED', {
          threadNumber: dto.threadNumber,
          username: occupied.username,
          inactiveMinutes,
          occupiedBy: {
            userId: occupied.user_id,
            username: occupied.username,
            lastSeenAt: occupied.last_seen_at,
          },
        });
      }

      // Take over in single transaction (§4.6, §7.6)
      return await this.dataSource.transaction(async (manager) => {
        const lockedRows = await manager.query(
          `SELECT qs.*, u.username
           FROM dori_queue_session qs
           JOIN dori_user u ON u.user_id = qs.user_id
           WHERE qs.queue_id = $1 AND qs.thread_number = $2
             AND qs.disconnected_at IS NULL
           FOR UPDATE OF qs`,
          [queueId, dto.threadNumber],
        );
        if (lockedRows.length === 0) {
          throw new DoriException('THREAD_UNAVAILABLE');
        }
        const lockedSession = lockedRows[0];

        // 1. Close old session
        await manager.query(
          `UPDATE dori_queue_session
           SET disconnected_at = $1, closure_reason = 'taken_over', closed_by_user_id = $2
           WHERE session_id = $3`,
          [now, user.userId, lockedSession.session_id],
        );

        // 2. Open new session
        const newSessionRes = await manager.query(
          `INSERT INTO dori_queue_session (queue_id, user_id, thread_number, mode, connected_at, last_seen_at)
           VALUES ($1, $2, $3, 'active', $4, $4)
           RETURNING *`,
          [queueId, user.userId, dto.threadNumber, now],
        );
        const newSession = newSessionRes[0];

        // 3. Reassign client in_progress if any (§4.6)
        let reassignedId: number | null = null;
        const currentClient = await manager.query(
          `SELECT customer_id FROM dori_customer
           WHERE current_session_id = $1 AND status = 'in_progress' AND is_active = TRUE`,
          [lockedSession.session_id],
        );

        if (currentClient && currentClient.length > 0) {
          reassignedId = currentClient[0].customer_id;
          await manager.query(
            `UPDATE dori_customer
             SET current_session_id = $1, updated_at = $2
             WHERE customer_id = $3`,
            [newSession.session_id, now, reassignedId],
          );
        }

        return {
          sessionId: newSession.session_id,
          queueId: newSession.queue_id,
          userId: newSession.user_id,
          threadNumber: newSession.thread_number,
          mode: 'active',
          connectedAt: newSession.connected_at,
          takenOverFromSessionId: lockedSession.session_id,
          reassignedRegistrationId: reassignedId,
        };
      });
    }

    // Thread is free, open directly
    let res: any[];
    try {
      res = await this.dataSource.query(
        `INSERT INTO dori_queue_session (queue_id, user_id, thread_number, mode, connected_at, last_seen_at)
         VALUES ($1, $2, $3, 'active', $4, $4)
         RETURNING *`,
        [queueId, user.userId, dto.threadNumber, now],
      );
    } catch (error) {
      const dbError = error as { code?: string; constraint?: string };
      if (dbError.code === '23505') {
        if (dbError.constraint === 'uk_queue_user_active') {
          throw new DoriException('SESSION_ALREADY_OPEN');
        }
        throw new DoriException('THREAD_OCCUPIED', {
          threadNumber: dto.threadNumber,
        });
      }
      throw error;
    }
    const session = res[0];

    return {
      sessionId: session.session_id,
      queueId: session.queue_id,
      userId: session.user_id,
      threadNumber: session.thread_number,
      mode: 'active',
      connectedAt: session.connected_at,
      takenOverFromSessionId: null,
      reassignedRegistrationId: null,
    };
  }

  // 3. Close Session (§4.6)
  async closeSession(
    queueId: number,
    sessionId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_queue_session
       SET disconnected_at = $1, closure_reason = 'logout', closed_by_user_id = $2
       WHERE session_id = $3 AND queue_id = $4 AND disconnected_at IS NULL`,
      [now, user.userId, sessionId, queueId],
    );

    return { sessionId, closed: true };
  }

  // 4. Next Client Call (§6.3, §4.4, §7.6)
  async next(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    // 1. User must hold an active session on this queue (§6.3, §7.6)
    const sessionRows = await this.dataSource.query(
      `SELECT * FROM dori_queue_session
       WHERE queue_id = $1 AND user_id = $2 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId, user.userId],
    );

    if (!sessionRows || sessionRows.length === 0) {
      throw new DoriException('THREAD_UNAVAILABLE');
    }

    const session = sessionRows[0];
    const now = this.clockService.now();

    // 2. Resolve queue & site weights and timezone (§4.4, §4.5)
    const configRows = await this.dataSource.query(
      `SELECT q.base_weight_walkin, q.base_weight_appointment,
              q.escalation_rate_walkin, q.escalation_rate_appointment,
              s.default_base_weight_walkin, s.default_base_weight_appointment,
              s.default_escalation_rate_walkin, s.default_escalation_rate_appointment,
              s.timezone
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );

    if (!configRows || configRows.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const cfg = configRows[0];
    const qBaseWalk = Number(
      cfg.base_weight_walkin ?? cfg.default_base_weight_walkin ?? 0,
    );
    const qBaseAppt = Number(
      cfg.base_weight_appointment ?? cfg.default_base_weight_appointment ?? 60,
    );
    const qRateWalk = Number(
      cfg.escalation_rate_walkin ?? cfg.default_escalation_rate_walkin ?? 1,
    );
    const qRateAppt = Number(
      cfg.escalation_rate_appointment ??
        cfg.default_escalation_rate_appointment ??
        1,
    );
    const timezone = cfg.timezone || 'Africa/Tunis';
    const businessDate = this.clockService.todayInTimezone(timezone);

    // 3. Execute atomic select and update in transaction using SKIP LOCKED (§7.6)
    const result = await this.dataSource.transaction(async (manager) => {
      // Pass 1: Eligible waiting clients ordered by priority score (§4.4, §7.6)
      const pass1Sql = `
        WITH eligible AS (
          SELECT c.customer_id,
                 ROUND(
                   (CASE WHEN c.entry_type = 'appointment'
                         THEN $1 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $2
                         ELSE $3 + EXTRACT(EPOCH FROM ($7 - c.priority_reference_time))/60 * $4
                    END)::numeric, 2
                 ) AS score
          FROM dori_customer c
          WHERE c.queue_id = $5
            AND c.business_date = $6
            AND c.status = 'waiting'
            AND c.is_active = TRUE
            AND (
              c.entry_type = 'walkin'
              OR (c.appointment_status = 'checked_in' AND c.scheduled_time <= $7)
            )
        )
        SELECT customer_id, score FROM eligible
        ORDER BY score DESC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

      let selectedRows = await manager.query(pass1Sql, [
        qBaseAppt,
        qRateAppt,
        qBaseWalk,
        qRateWalk,
        queueId,
        businessDate,
        now,
      ]);

      let calledEarly = false;
      let finalScore = 0;

      // Pass 2: Fallback to checked-in appointments not yet at their time (§4.4, §7.6)
      if (!selectedRows || selectedRows.length === 0) {
        const pass2Sql = `
          SELECT customer_id, 0 as score
          FROM dori_customer
          WHERE queue_id = $1
            AND business_date = $2
            AND status = 'waiting'
            AND is_active = TRUE
            AND appointment_status = 'checked_in'
            AND scheduled_time > $3
          ORDER BY scheduled_time ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `;

        selectedRows = await manager.query(pass2Sql, [
          queueId,
          businessDate,
          now,
        ]);
        if (selectedRows && selectedRows.length > 0) {
          calledEarly = true;
        }
      }

      // If still none, queue is empty (§6.3, §6.9)
      if (!selectedRows || selectedRows.length === 0) {
        throw new DoriException('QUEUE_EMPTY');
      }

      const candidate = selectedRows[0];
      const customerId = candidate.customer_id;
      finalScore = Number(candidate.score || 0);

      // Transition customer to in_progress
      await manager.query(
        `UPDATE dori_customer
         SET status = 'in_progress', current_session_id = $1, called_at = $2, updated_at = $2
         WHERE customer_id = $3`,
        [session.session_id, now, customerId],
      );

      // Fetch complete details for response (§6.3)
      const detailRows = await manager.query(
        `SELECT c.customer_id, c.ticket_number, c.entry_type, c.scheduled_time, c.status, c.called_at,
                c.registration_tracking_token,
                t.tier_id, t.tier_code, t.tier_name,
                p.person_id, p.first_name, p.last_name, p.phone_number,
                (SELECT COUNT(*)::int FROM dori_person_note n WHERE n.person_id = p.person_id AND n.is_active = TRUE) as notes_count
         FROM dori_customer c
         JOIN dori_service_tier t ON t.tier_id = c.tier_id
         JOIN dori_person p ON p.person_id = c.person_id
         WHERE c.customer_id = $1`,
        [customerId],
      );

      const d = detailRows[0];

      return {
        registrationId: d.customer_id,
        ticketNumber: d.ticket_number,
        entryType: d.entry_type,
        scheduledTime: d.scheduled_time,
        calledEarly,
        tier: {
          tierId: d.tier_id,
          tierCode: d.tier_code,
          tierName: d.tier_name,
        },
        status: d.status,
        sessionId: session.session_id,
        threadNumber: session.thread_number,
        priorityScore: finalScore,
        calledAt: d.called_at,
        person: {
          personId: d.person_id,
          firstName: d.first_name,
          lastName: d.last_name,
          phone: d.phone_number,
          hasNotes: (d.notes_count || 0) > 0,
        },
        trackingToken: d.registration_tracking_token,
      };
    });
    this.realtimeService.emitQueueOps(queueId, 'customer_called', result);
    this.realtimeService.emitQueueDisplay(queueId, 'customer_called', {
      ticketNumber: result.ticketNumber,
      threadNumber: result.threadNumber,
    });
    this.realtimeService.emitRegistrationUpdate(result.trackingToken, {
      ticketNumber: result.ticketNumber,
      status: result.status,
    });
    const { trackingToken: _trackingToken, ...response } = result;
    return response;
  }

  // 5. Close Customer Served / No-Show (§6.4)
  async markServed(registrationId: number, user: AuthenticatedUser) {
    const now = this.clockService.now();

    // Verify registration is in_progress on a session owned by caller (§6.4)
    const rows = await this.dataSource.query(
      `SELECT c.*, qs.user_id as session_user_id
       FROM dori_customer c
       JOIN dori_queue_session qs ON qs.session_id = c.current_session_id
       WHERE c.customer_id = $1 AND c.status = 'in_progress' AND c.is_active = TRUE`,
      [registrationId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('REGISTRATION_NOT_IN_PROGRESS', {
        status: 'waiting',
      });
    }

    const reg = rows[0];
    if (reg.session_user_id !== user.userId) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    await this.dataSource.query(
      `UPDATE dori_customer
       SET status = 'served', served_at = $1, closed_at = $1, updated_at = $1
       WHERE customer_id = $2`,
      [now, registrationId],
    );

    return {
      registrationId,
      status: 'served',
      servedAt: now,
      closedAt: now,
      handledBySessionId: reg.current_session_id,
      handledByUserId: user.userId,
    };
  }

  async markNoShow(registrationId: number, user: AuthenticatedUser) {
    const now = this.clockService.now();

    const rows = await this.dataSource.query(
      `SELECT c.*, qs.user_id as session_user_id
       FROM dori_customer c
       JOIN dori_queue_session qs ON qs.session_id = c.current_session_id
       WHERE c.customer_id = $1 AND c.status = 'in_progress' AND c.is_active = TRUE`,
      [registrationId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('REGISTRATION_NOT_IN_PROGRESS', {
        status: 'waiting',
      });
    }

    const reg = rows[0];
    if (reg.session_user_id !== user.userId) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    // no-show is terminal and sets is_active = FALSE (§4.7)
    await this.dataSource.query(
      `UPDATE dori_customer
       SET status = 'no_show', closed_at = $1, is_active = FALSE, updated_at = $1
       WHERE customer_id = $2`,
      [now, registrationId],
    );

    return {
      registrationId,
      status: 'no_show',
      servedAt: null,
      closedAt: now,
      handledBySessionId: reg.current_session_id,
      handledByUserId: user.userId,
    };
  }

  // Active supervision sessions (§5.8)
  async getSessions(
    queueId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueSessionDetailDto>> {
    let pagination: PaginationDto;
    let user: AuthenticatedUser;

    if (paginationOrUser && 'userId' in paginationOrUser) {
      user = paginationOrUser as AuthenticatedUser;
      pagination = new PaginationDto();
    } else {
      pagination = (paginationOrUser as PaginationDto) || new PaginationDto();
      user = maybeUser!;
    }

    await this.scopeService.checkQueueAccess(user, queueId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      [
        'qs.connected_at',
        'qs.session_id',
        'qs.thread_number',
        'qs.mode',
        'u.username',
      ],
      'qs.connected_at',
    );

    const baseSql = `
      FROM dori_queue_session qs
      JOIN dori_user u ON u.user_id = qs.user_id
      WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total ${baseSql}`,
      [queueId],
    );
    const total = countRes[0]?.total || 0;

    const sessions = await this.dataSource.query(
      `SELECT qs.session_id, qs.queue_id, qs.thread_number, qs.user_id,
              u.username, qs.mode, qs.connected_at, qs.disconnected_at ${baseSql}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`,
      [queueId],
    );

    return pagination.createResponse<QueueSessionDetailDto>(sessions, total);
  }

  // 6. Next Preview (§10.2)
  async nextPreview(
    limit: number = 6,
    siteId?: number,
    queueId?: number,
    user?: AuthenticatedUser,
  ) {
    const scope = user
      ? await this.scopeService.getUserScope(user)
      : { isGlobal: true, siteIds: [], queueIds: [] };
    const now = this.clockService.now();

    let targetQueueIds: number[] = [];

    if (queueId) {
      if (user) await this.scopeService.checkQueueAccess(user, queueId);
      targetQueueIds = [queueId];
    } else if (siteId) {
      if (user) await this.scopeService.checkSiteAccess(user, siteId);
      const rows = await this.dataSource.query(
        `SELECT queue_id FROM dori_site_queue_thread WHERE site_id = $1 AND is_active = TRUE`,
        [siteId],
      );
      targetQueueIds = rows.map((r: any) => Number(r.queue_id));
    } else {
      if (scope.isGlobal) {
        const rows = await this.dataSource.query(
          `SELECT queue_id FROM dori_site_queue_thread WHERE is_active = TRUE`,
        );
        targetQueueIds = rows.map((r: any) => Number(r.queue_id));
      } else {
        targetQueueIds = scope.queueIds;
      }
    }

    if (targetQueueIds.length === 0) {
      return [];
    }

    const candidates = await this.dataSource.query(
      `
      WITH eligible AS (
        SELECT c.customer_id,
               c.ticket_number,
               c.entry_type,
               c.scheduled_time,
               c.priority_reference_time,
               c.queue_id,
               q.queue_code,
               q.queue_name,
               s.site_name,
               p.person_id,
               p.first_name,
               p.last_name,
               ROUND(
                 (CASE WHEN c.entry_type = 'appointment'
                       THEN COALESCE(q.base_weight_appointment, s.default_base_weight_appointment, 60)
                            + EXTRACT(EPOCH FROM ($2 - c.priority_reference_time))/60
                            * COALESCE(q.escalation_rate_appointment, s.default_escalation_rate_appointment, 1)
                       ELSE COALESCE(q.base_weight_walkin, s.default_base_weight_walkin, 0)
                            + EXTRACT(EPOCH FROM ($2 - c.priority_reference_time))/60
                            * COALESCE(q.escalation_rate_walkin, s.default_escalation_rate_walkin, 1)
                  END)::numeric, 2
               ) AS score,
               FALSE as called_early
        FROM dori_customer c
        JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
        JOIN dori_site s ON s.site_id = q.site_id
        JOIN dori_person p ON p.person_id = c.person_id
        WHERE c.queue_id = ANY($1)
          AND c.status = 'waiting'
          AND c.is_active = TRUE
          AND (
            c.entry_type = 'walkin'
            OR (c.appointment_status = 'checked_in' AND c.scheduled_time <= $2)
          )
      )
      SELECT * FROM eligible
      ORDER BY score DESC
      LIMIT $3
      `,
      [targetQueueIds, now, limit],
    );

    let results = candidates.map((c: any) => ({
      registrationId: c.customer_id,
      ticketNumber: c.ticket_number,
      queueId: c.queue_id,
      queueCode: c.queue_code,
      queueName: c.queue_name,
      siteName: c.site_name,
      entryType: c.entry_type,
      scheduledTime: c.scheduled_time,
      priorityScore: Number(c.score),
      calledEarly: false,
      person: {
        personId: c.person_id,
        firstName: c.first_name,
        lastName: c.last_name,
      },
    }));

    if (results.length < limit) {
      const remaining = limit - results.length;
      const existingIds = results.map((r: any) => r.registrationId);
      const earlyCandidates = await this.dataSource.query(
        `
        SELECT c.customer_id,
               c.ticket_number,
               c.entry_type,
               c.scheduled_time,
               c.priority_reference_time,
               c.queue_id,
               q.queue_code,
               q.queue_name,
               s.site_name,
               p.person_id,
               p.first_name,
               p.last_name
        FROM dori_customer c
        JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
        JOIN dori_site s ON s.site_id = q.site_id
        JOIN dori_person p ON p.person_id = c.person_id
        WHERE c.queue_id = ANY($1)
          AND c.status = 'waiting'
          AND c.is_active = TRUE
          AND c.entry_type = 'appointment'
          AND c.appointment_status = 'checked_in'
          AND c.scheduled_time > $2
          ${existingIds.length > 0 ? `AND c.customer_id NOT IN (${existingIds.join(',')})` : ''}
        ORDER BY c.scheduled_time ASC
        LIMIT $3
        `,
        [targetQueueIds, now, remaining],
      );

      const earlyResults = earlyCandidates.map((c: any) => ({
        registrationId: c.customer_id,
        ticketNumber: c.ticket_number,
        queueId: c.queue_id,
        queueCode: c.queue_code,
        queueName: c.queue_name,
        siteName: c.site_name,
        entryType: c.entry_type,
        scheduledTime: c.scheduled_time,
        priorityScore: 0,
        calledEarly: true,
        person: {
          personId: c.person_id,
          firstName: c.first_name,
          lastName: c.last_name,
        },
      }));

      results = [...results, ...earlyResults];
    }

    return results;
  }

  async previewNext(
    user: AuthenticatedUser,
    siteId?: number,
    limit?: number,
    queueId?: number,
  ) {
    return this.nextPreview(limit ?? 10, siteId, queueId, user);
  }

  async getThreadsStatus(
    queueId: number,
    user: AuthenticatedUser,
    pagination?: PaginationDto,
  ) {
    return this.getThreads(queueId, user, pagination);
  }

  async getActiveSessions(
    queueId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueSessionDetailDto>> {
    return this.getSessions(queueId, paginationOrUser, maybeUser);
  }

  async callNext(queueId: number, user: AuthenticatedUser) {
    return this.next(queueId, user);
  }
}
