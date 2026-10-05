import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto, QueueFilterDto } from './dto/update-queue.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { QueueDetailResponseDto } from './dto/queue-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class QueuesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findQueues(
    filter: QueueFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueDetailResponseDto>> {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    // VAL-01 : allowlist des colonnes autorisées pour dori_site_queue_thread (alias q)
    const sortField = filter.getSafeSortField(
      [
        'q.queue_id',
        'q.queue_name',
        'q.queue_code',
        'q.created_at',
        'q.updated_at',
        's.site_name',
      ],
      'q.created_at',
    );

    let query = `
      SELECT q.*, s.site_name, s.timezone, s.default_currency
      FROM dori_site_queue_thread q
      JOIN dori_site s ON s.site_id = q.site_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.isActive !== undefined) {
      params.push(filter.isActive);
      query += ` AND q.is_active = $${params.length}`;
    } else {
      query += ` AND q.is_active = TRUE`;
    }

    if (filter.siteId) {
      await this.scopeService.checkSiteAccess(user, filter.siteId);
      params.push(filter.siteId);
      query += ` AND q.site_id = $${params.length}`;
    } else if (!scope.isGlobal) {
      if (user.roles?.includes('manager')) {
        if (scope.siteIds.length === 0) return filter.createResponse([], 0);
        params.push(scope.siteIds);
        query += ` AND q.site_id = ANY($${params.length})`;
      } else {
        if (scope.queueIds.length === 0) return filter.createResponse([], 0);
        params.push(scope.queueIds);
        query += ` AND q.queue_id = ANY($${params.length})`;
      }
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      query += ` AND (q.queue_name ILIKE $${params.length} OR q.queue_code ILIKE $${params.length})`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) count_sub`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async findQueueById(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const rows = await this.dataSource.query(
      `SELECT q.*, s.site_name, s.timezone as site_timezone, s.default_currency as site_default_currency,
              s.default_appointments_enabled, s.default_appointment_slot_duration, s.default_slot_capacity,
              s.default_working_hours_start, s.default_working_hours_end, s.default_break_start, s.default_break_end,
              s.default_late_tolerance_minutes, s.default_base_weight_walkin, s.default_base_weight_appointment,
              s.default_escalation_rate_walkin, s.default_escalation_rate_appointment, s.default_carry_over_waiting,
              s.default_daily_reset_mode, s.default_daily_reset_time, s.default_locale
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1 AND q.is_active = TRUE`,
      [queueId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const row = rows[0];

    // Inheritance resolution (§4.5): resolve effective values & origins
    const resolveField = (queueVal: any, siteVal: any) => ({
      value: queueVal !== null && queueVal !== undefined ? queueVal : siteVal,
      origin:
        queueVal !== null && queueVal !== undefined
          ? 'overridden'
          : 'inherited',
    });

    return {
      queueId: row.queue_id,
      queueCode: row.queue_code,
      siteId: row.site_id,
      siteName: row.site_name,
      queueName: row.queue_name,
      isActive: row.is_active,
      averageWaitTime: row.average_wait_time,
      threadCount: row.thread_count,
      config: {
        appointmentsEnabled: resolveField(
          row.appointments_enabled,
          row.default_appointments_enabled,
        ),
        appointmentSlotDuration: resolveField(
          row.appointment_slot_duration,
          row.default_appointment_slot_duration,
        ),
        slotCapacity: resolveField(
          row.slot_capacity,
          row.default_slot_capacity,
        ),
        workingHoursStart: resolveField(
          row.working_hours_start,
          row.default_working_hours_start,
        ),
        workingHoursEnd: resolveField(
          row.working_hours_end,
          row.default_working_hours_end,
        ),
        breakStart: resolveField(row.break_start, row.default_break_start),
        breakEnd: resolveField(row.break_end, row.default_break_end),
        lateToleranceMinutes: resolveField(
          row.late_tolerance_minutes,
          row.default_late_tolerance_minutes,
        ),
        baseWeightWalkin: resolveField(
          row.base_weight_walkin,
          row.default_base_weight_walkin,
        ),
        baseWeightAppointment: resolveField(
          row.base_weight_appointment,
          row.default_base_weight_appointment,
        ),
        escalationRateWalkin: resolveField(
          row.escalation_rate_walkin,
          row.default_escalation_rate_walkin,
        ),
        escalationRateAppointment: resolveField(
          row.escalation_rate_appointment,
          row.default_escalation_rate_appointment,
        ),
        carryOverWaiting: resolveField(
          row.carry_over_waiting,
          row.default_carry_over_waiting,
        ),
        dailyResetMode: resolveField(
          row.daily_reset_mode,
          row.default_daily_reset_mode,
        ),
        dailyResetTime: resolveField(
          row.daily_reset_time,
          row.default_daily_reset_time,
        ),
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createQueue(
    siteId: number,
    dto: CreateQueueDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const now = this.clockService.now();

    const siteRes = await this.dataSource.query(
      `SELECT default_currency FROM dori_site WHERE site_id = $1 AND is_active = TRUE`,
      [siteId],
    );
    if (!siteRes || siteRes.length === 0) {
      throw new DoriException('SITE_NOT_FOUND', { siteId });
    }
    const defaultCurrency = siteRes[0].default_currency || 'TND';

    const insertQuery = `
      INSERT INTO dori_site_queue_thread (
        queue_code, site_id, queue_name, average_wait_time, thread_count,
        appointments_enabled, appointment_slot_duration, slot_capacity,
        working_hours_start, working_hours_end, break_start, break_end, late_tolerance_minutes,
        base_weight_walkin, base_weight_appointment, escalation_rate_walkin, escalation_rate_appointment,
        carry_over_waiting, daily_reset_mode, daily_reset_time, created_by_user_id, updated_by_user_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, COALESCE($4, 10), COALESCE($5, 1),
        $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $21,
        $22, $22
      ) RETURNING *
    `;

    const values = [
      dto.queueCode,
      siteId,
      dto.queueName || null,
      dto.averageWaitTime ?? null,
      dto.threadCount ?? null,
      dto.appointmentsEnabled ?? null,
      dto.appointmentSlotDuration ?? null,
      dto.slotCapacity ?? null,
      dto.workingHoursStart || null,
      dto.workingHoursEnd || null,
      dto.breakStart || null,
      dto.breakEnd || null,
      dto.lateToleranceMinutes ?? null,
      dto.baseWeightWalkin ?? null,
      dto.baseWeightAppointment ?? null,
      dto.escalationRateWalkin ?? null,
      dto.escalationRateAppointment ?? null,
      dto.carryOverWaiting ?? null,
      dto.dailyResetMode || null,
      dto.dailyResetTime || null,
      user.userId,
      now,
    ];

    const res = await this.dataSource.query(insertQuery, values);
    const newQueue = res[0];

    // Invariant §3.7: associate free tier (tierId = 1 or code = 'free') with price 0
    const freeTier = await this.dataSource.query(
      `SELECT tier_id FROM dori_service_tier WHERE tier_code = 'free' LIMIT 1`,
    );
    if (freeTier && freeTier.length > 0) {
      await this.dataSource.query(
        `INSERT INTO dori_queue_service_tier (queue_id, tier_id, price, currency, display_order, created_by_user_id, updated_by_user_id, created_at, updated_at)
         VALUES ($1, $2, 0, $3, 0, $4, $4, $5, $5)
         ON CONFLICT (queue_id, tier_id) DO NOTHING`,
        [
          newQueue.queue_id,
          freeTier[0].tier_id,
          defaultCurrency,
          user.userId,
          now,
        ],
      );
    }

    return newQueue;
  }

  async updateQueue(
    queueId: number,
    dto: UpdateQueueDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const mapField = (dbCol: string, val: any) => {
      if (val !== undefined) {
        fields.push(`${dbCol} = $${idx++}`);
        values.push(val);
      }
    };

    mapField('queue_code', dto.queueCode);
    mapField('queue_name', dto.queueName);
    mapField('average_wait_time', dto.averageWaitTime);
    mapField('thread_count', dto.threadCount);
    mapField('appointments_enabled', dto.appointmentsEnabled);
    mapField('appointment_slot_duration', dto.appointmentSlotDuration);
    mapField('slot_capacity', dto.slotCapacity);
    mapField('working_hours_start', dto.workingHoursStart);
    mapField('working_hours_end', dto.workingHoursEnd);
    mapField('break_start', dto.breakStart);
    mapField('break_end', dto.breakEnd);
    mapField('late_tolerance_minutes', dto.lateToleranceMinutes);
    mapField('base_weight_walkin', dto.baseWeightWalkin);
    mapField('base_weight_appointment', dto.baseWeightAppointment);
    mapField('escalation_rate_walkin', dto.escalationRateWalkin);
    mapField('escalation_rate_appointment', dto.escalationRateAppointment);
    mapField('carry_over_waiting', dto.carryOverWaiting);
    mapField('daily_reset_mode', dto.dailyResetMode);
    mapField('daily_reset_time', dto.dailyResetTime);
    mapField('is_active', dto.isActive);

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(queueId);

    const result = await this.dataSource.query(
      `UPDATE dori_site_queue_thread SET ${fields.join(', ')} WHERE queue_id = $${idx} RETURNING *`,
      values,
    );
    return result[0];
  }

  async deleteQueue(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);
    await this.findQueueById(queueId, user);

    const now = this.clockService.now();

    // 1. Soft delete de la file d'attente
    await this.dataSource.query(
      `UPDATE dori_site_queue_thread
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE queue_id = $3`,
      [now, user.userId, queueId],
    );

    // 2. Cascade de désactivation sur les forfaits associés à cette file
    await this.dataSource.query(
      `UPDATE dori_queue_service_tier
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE queue_id = $3 AND is_active = TRUE`,
      [now, user.userId, queueId],
    );

    // 3. Fermeture des sessions guichet actives de la file
    await this.dataSource.query(
      `UPDATE dori_queue_session
       SET disconnected_at = $1, closure_reason = 'forced', closed_by_user_id = $2
       WHERE queue_id = $3 AND disconnected_at IS NULL`,
      [now, user.userId, queueId],
    );

    this.scopeService.clearAllScopeCache();

    return { queueId, deleted: true };
  }

  async getQueueStatus(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const queueRes = await this.dataSource.query(
      `SELECT q.average_wait_time, s.timezone
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );

    if (!queueRes || queueRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const { average_wait_time, timezone } = queueRes[0];
    const businessDate = this.clockService.todayInTimezone(timezone);

    // Count waiting clients
    const waitingRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count
       FROM dori_customer
       WHERE queue_id = $1 AND business_date = $2 AND status = 'waiting' AND is_active = TRUE`,
      [queueId, businessDate],
    );
    const waitingCount = waitingRes[0]?.count || 0;

    // Count active threads
    const activeThreadsRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count
       FROM dori_queue_session
       WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId],
    );
    const activeThreads = activeThreadsRes[0]?.count || 0;

    // Next appointments today
    const appts = await this.dataSource.query(
      `SELECT customer_id, ticket_number, scheduled_time, appointment_status, status
       FROM dori_customer
       WHERE queue_id = $1 AND business_date = $2 AND entry_type = 'appointment' AND is_active = TRUE
         AND status IN ('booked', 'waiting')
       ORDER BY scheduled_time ASC
       LIMIT 5`,
      [queueId, businessDate],
    );

    const divisor = Math.max(1, activeThreads);
    const estimatedWaitMinutes = Math.round(
      (waitingCount * average_wait_time) / divisor,
    );

    return {
      queueId,
      waitingCount,
      activeThreads,
      estimatedWaitMinutes,
      nextAppointments: appts,
    };
  }

  async getQueueDisplay(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const queueRes = await this.dataSource.query(
      `SELECT q.thread_count, s.timezone
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );

    if (!queueRes || queueRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const { timezone } = queueRes[0];
    const businessDate = this.clockService.todayInTimezone(timezone);

    // Current called ticket per active thread (threadNumber, ticketNumber only)
    const activeSessions = await this.dataSource.query(
      `SELECT qs.thread_number, c.ticket_number, c.customer_id
       FROM dori_queue_session qs
       LEFT JOIN dori_customer c ON c.current_session_id = qs.session_id AND c.status = 'in_progress' AND c.is_active = TRUE
       WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL AND qs.mode = 'active'
       ORDER BY qs.thread_number ASC`,
      [queueId],
    );

    // Next waiting tickets (only ticket numbers, no personal info!)
    const nextTickets = await this.dataSource.query(
      `SELECT ticket_number
       FROM dori_customer
       WHERE queue_id = $1 AND business_date = $2 AND status = 'waiting' AND is_active = TRUE
       ORDER BY priority_reference_time ASC
       LIMIT 10`,
      [queueId, businessDate],
    );

    return {
      queueId,
      activeThreads: activeSessions.map((s: any) => ({
        threadNumber: s.thread_number,
        currentTicket: s.ticket_number || null,
      })),
      nextTickets: nextTickets.map((t: any) => t.ticket_number),
    };
  }

  async resetQueue(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    // Run queue closure per §4.8
    const now = this.clockService.now();
    const rows = await this.dataSource.query(
      `SELECT q.carry_over_waiting, q.daily_reset_mode, s.default_carry_over_waiting, s.default_daily_reset_mode, s.timezone
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const {
      carry_over_waiting,
      daily_reset_mode,
      default_carry_over_waiting,
      default_daily_reset_mode,
      timezone,
    } = rows[0];
    const shouldCarryOver =
      carry_over_waiting !== null
        ? carry_over_waiting
        : default_carry_over_waiting;
    const resetMode =
      daily_reset_mode || default_daily_reset_mode || 'close_all';
    const businessDate = this.clockService.todayInTimezone(timezone);
    const tomorrow = this.clockService.tomorrowInTimezone(timezone);

    await this.dataSource.transaction(async (manager) => {
      // 1. Close open threads
      await manager.query(
        `UPDATE dori_queue_session
         SET disconnected_at = $1, closure_reason = 'daily_reset', closed_by_user_id = $2
         WHERE queue_id = $3 AND disconnected_at IS NULL`,
        [now, user.userId, queueId],
      );

      // 2. Process waiting/booked of the closed day
      if (!shouldCarryOver) {
        await manager.query(
          `UPDATE dori_customer
           SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3 AND status = 'waiting' AND is_active = TRUE`,
          [now, queueId, businessDate],
        );
      } else {
        // Carry over: tickets already OLD- expire
        await manager.query(
          `UPDATE dori_customer
           SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3 AND status = 'waiting' AND is_active = TRUE
             AND ticket_number LIKE 'OLD-%'`,
          [now, queueId, businessDate],
        );

        // Tickets not OLD- get carry over: ticket_number = OLD-...
        await manager.query(
          `UPDATE dori_customer
           SET business_date = $1, carried_over_from_date = $2, ticket_number = 'OLD-' || ticket_number,
               registration_tracking_token_valid_until = $3, updated_at = $4
           WHERE queue_id = $5 AND business_date = $2 AND status = 'waiting' AND is_active = TRUE
             AND ticket_number NOT LIKE 'OLD-%'`,
          [
            tomorrow,
            businessDate,
            new Date(now.getTime() + 24 * 60 * 60 * 1000),
            now,
            queueId,
          ],
        );
      }

      // 3. Neutralize closed registrations per resetMode
      if (resetMode === 'close_all') {
        await manager.query(
          `UPDATE dori_customer
           SET is_active = FALSE, deleted_at = $1, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3 AND status IN ('served', 'no_show', 'expired', 'cancelled') AND is_active = TRUE`,
          [now, queueId, businessDate],
        );
      } else {
        await manager.query(
          `UPDATE dori_customer
           SET is_active = FALSE, deleted_at = $1, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3 AND status = 'served' AND is_active = TRUE`,
          [now, queueId, businessDate],
        );
      }
    });

    return { queueId, reset: true, timestamp: now };
  }

  async getOperators(
    queueId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    // VAL-01 : allowlist pour le JOIN dori_user_queue / dori_user
    const sortField = pagination.getSafeSortField(
      ['u.user_id', 'u.username', 'u.email', 'uq.assigned_at'],
      'uq.assigned_at',
    );

    const query = `
      SELECT u.user_id, u.username, u.email, u.user_type, uq.assigned_at
      FROM dori_user_queue uq
      JOIN dori_user u ON u.user_id = uq.user_id
      WHERE uq.queue_id = $1 AND u.is_active = TRUE
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      [queueId],
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `${query} ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      [queueId],
    );

    return pagination.createResponse(items, total);
  }

  async assignOperator(
    queueId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    // Ensure assigning user (if manager) has access to the site of this queue (§4.10)
    const queueSiteRes = await this.dataSource.query(
      `SELECT site_id FROM dori_site_queue_thread WHERE queue_id = $1`,
      [queueId],
    );
    if (!queueSiteRes || queueSiteRes.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    const siteId = queueSiteRes[0].site_id;
    await this.scopeService.checkSiteAccess(user, siteId);

    // SEC-04 : 1. Vérifier que le targetUser existe et est actif
    const userRes = await this.dataSource.query(
      `SELECT user_id, is_active FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [targetUserId],
    );
    if (!userRes || userRes.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    if (!userRes[0].is_active) {
      throw new DoriException('ACCOUNT_LOCKED', { userId: targetUserId });
    }

    // SEC-04 : 2. Vérifier que le targetUser possède bien le rôle 'hotesse' (ou 'operator') actif
    const operatorRoleRes = await this.dataSource.query(
      `SELECT ur.user_id
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name IN ('hotesse', 'operator') AND r.is_active = TRUE
       LIMIT 1`,
      [targetUserId],
    );
    if (!operatorRoleRes || operatorRoleRes.length === 0) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }

    const now = this.clockService.now();
    await this.dataSource.query(
      `INSERT INTO dori_user_queue (user_id, queue_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, queue_id) DO NOTHING`,
      [targetUserId, queueId, now, user.userId],
    );

    this.scopeService.invalidateUserScope(targetUserId);
    return { queueId, userId: targetUserId, assigned: true };
  }

  async removeOperator(
    queueId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    await this.dataSource.query(
      `DELETE FROM dori_user_queue WHERE user_id = $1 AND queue_id = $2`,
      [targetUserId, queueId],
    );

    this.scopeService.invalidateUserScope(targetUserId);
    return { queueId, userId: targetUserId, removed: true };
  }
}
