import { Injectable } from '@nestjs/common';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto, QueueFilterDto } from './dto/update-queue.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { QueueResponseDto } from './dto/queue-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { QueueDetailRow, QueuesRepository } from './queues.repository';

@Injectable()
export class QueuesService {
  constructor(
    private readonly queuesRepository: QueuesRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  private mapQueueResponse(row: QueueDetailRow): QueueResponseDto {
    const effective = (queueField: string, siteField: string) =>
      row[queueField] !== null && row[queueField] !== undefined
        ? row[queueField]
        : row[siteField];
    const origin = (queueField: string): 'inherited' | 'overridden' =>
      row[queueField] !== null && row[queueField] !== undefined
        ? 'overridden'
        : 'inherited';

    return {
      queueId: row.queue_id,
      queueCode: row.queue_code,
      siteId: row.site_id,
      queueName: row.queue_name,
      averageWaitTime: row.average_wait_time,
      threadCount: row.thread_count,
      currency: effective('currency', 'default_currency'),
      locale: effective('locale', 'default_locale'),
      appointmentsEnabled: effective(
        'appointments_enabled',
        'default_appointments_enabled',
      ),
      appointmentSlotDuration: effective(
        'appointment_slot_duration',
        'default_appointment_slot_duration',
      ),
      slotCapacity: effective('slot_capacity', 'default_slot_capacity'),
      workingHoursStart: effective(
        'working_hours_start',
        'default_working_hours_start',
      ),
      workingHoursEnd: effective(
        'working_hours_end',
        'default_working_hours_end',
      ),
      breakStart: effective('break_start', 'default_break_start'),
      breakEnd: effective('break_end', 'default_break_end'),
      lateToleranceMinutes: effective(
        'late_tolerance_minutes',
        'default_late_tolerance_minutes',
      ),
      baseWeightWalkin: Number(
        effective('base_weight_walkin', 'default_base_weight_walkin'),
      ),
      baseWeightAppointment: Number(
        effective('base_weight_appointment', 'default_base_weight_appointment'),
      ),
      escalationRateWalkin: Number(
        effective('escalation_rate_walkin', 'default_escalation_rate_walkin'),
      ),
      escalationRateAppointment: Number(
        effective(
          'escalation_rate_appointment',
          'default_escalation_rate_appointment',
        ),
      ),
      carryOverWaiting: effective(
        'carry_over_waiting',
        'default_carry_over_waiting',
      ),
      dailyResetMode: effective('daily_reset_mode', 'default_daily_reset_mode'),
      dailyResetTime: effective('daily_reset_time', 'default_daily_reset_time'),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      configOrigins: {
        currency: origin('currency'),
        locale: origin('locale'),
        appointmentsEnabled: origin('appointments_enabled'),
        appointmentSlotDuration: origin('appointment_slot_duration'),
        slotCapacity: origin('slot_capacity'),
        workingHoursStart: origin('working_hours_start'),
        workingHoursEnd: origin('working_hours_end'),
        breakStart: origin('break_start'),
        breakEnd: origin('break_end'),
        lateToleranceMinutes: origin('late_tolerance_minutes'),
        baseWeightWalkin: origin('base_weight_walkin'),
        baseWeightAppointment: origin('base_weight_appointment'),
        escalationRateWalkin: origin('escalation_rate_walkin'),
        escalationRateAppointment: origin('escalation_rate_appointment'),
        carryOverWaiting: origin('carry_over_waiting'),
        dailyResetMode: origin('daily_reset_mode'),
        dailyResetTime: origin('daily_reset_time'),
      },
    };
  }

  async findQueues(
    filter: QueueFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueResponseDto>> {
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

    let siteIds: number[] | undefined;
    let queueIds: number[] | undefined;
    if (filter.siteId) {
      await this.scopeService.checkSiteAccess(user, filter.siteId);
    } else if (!scope.isGlobal) {
      if (user.roles?.includes('manager')) {
        if (scope.siteIds.length === 0) return filter.createResponse([], 0);
        siteIds = scope.siteIds;
      } else {
        if (scope.queueIds.length === 0) return filter.createResponse([], 0);
        queueIds = scope.queueIds;
      }
    }
    const result = await this.queuesRepository.findPage({
      isActive: filter.isActive,
      siteId: filter.siteId,
      siteIds,
      queueIds,
      search: filter.search,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });

    return filter.createResponse(
      result.items.map((row) => this.mapQueueResponse(row)),
      result.total,
    );
  }

  async findQueueById(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const row = await this.queuesRepository.findActiveById(queueId);
    if (!row) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    return this.mapQueueResponse(row);
  }

  async createQueue(
    siteId: number,
    dto: CreateQueueDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const now = this.clockService.now();

    const queueId = await this.queuesRepository.createWithDefaultTier(
      siteId,
      dto,
      user.userId,
      now,
    );
    if (queueId == null) {
      throw new DoriException('SITE_NOT_FOUND', { siteId });
    }

    // Invariant §3.7: associate free tier (tierId = 1 or code = 'free') with price 0
    return this.findQueueById(queueId, user);
  }

  async updateQueue(
    queueId: number,
    dto: UpdateQueueDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    const updated = await this.queuesRepository.update(
      queueId,
      dto,
      user.userId,
      now,
    );
    if (!updated) throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    return this.findQueueById(queueId, user);
  }

  async deleteQueue(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);
    await this.findQueueById(queueId, user);

    const now = this.clockService.now();

    // 1. Soft delete de la file d'attente
    await this.queuesRepository.deactivate(queueId, user.userId, now);

    // 2. Cascade de désactivation sur les forfaits associés à cette file

    // 3. Fermeture des sessions guichet actives de la file

    this.scopeService.clearAllScopeCache();

    return { queueId, deleted: true };
  }

  async getQueueStatus(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const context = await this.queuesRepository.findOperationalContext(queueId);
    if (!context) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    const { average_wait_time, timezone } = context;
    const businessDate = this.clockService.todayInTimezone(timezone);
    const snapshot = await this.queuesRepository.getStatusSnapshot(
      queueId,
      businessDate,
    );

    const divisor = Math.max(1, snapshot.activeThreads);
    const estimatedWaitMinutes = Math.round(
      (snapshot.waitingCount * average_wait_time) / divisor,
    );

    return {
      queueId,
      waitingCount: snapshot.waitingCount,
      activeThreads: snapshot.activeThreads,
      estimatedWaitMinutes,
      nextAppointments: snapshot.nextAppointments,
    };
  }

  async getQueueDisplay(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const context = await this.queuesRepository.findOperationalContext(queueId);
    if (!context) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    const { timezone } = context;
    const businessDate = this.clockService.todayInTimezone(timezone);
    return {
      queueId,
      ...(await this.queuesRepository.getDisplaySnapshot(
        queueId,
        businessDate,
      )),
    };
  }

  async resetQueue(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);

    // Run queue closure per §4.8
    const now = this.clockService.now();
    const context = await this.queuesRepository.findOperationalContext(queueId);
    if (!context) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const {
      carry_over_waiting,
      daily_reset_mode,
      default_carry_over_waiting,
      default_daily_reset_mode,
      timezone,
    } = context;
    const shouldCarryOver =
      carry_over_waiting !== null
        ? carry_over_waiting
        : default_carry_over_waiting;
    const resetMode =
      daily_reset_mode || default_daily_reset_mode || 'close_all';
    const businessDate = this.clockService.todayInTimezone(timezone);
    const tomorrow = this.clockService.tomorrowInTimezone(timezone);

    await this.queuesRepository.reset({
      queueId,
      userId: user.userId,
      now,
      businessDate,
      tomorrow,
      trackingValidUntil: this.clockService.addDays(now, 1),
      carryOver: shouldCarryOver ?? false,
      resetMode,
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

    const result = await this.queuesRepository.findOperatorPage({
      queueId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });
    return pagination.createResponse(result.items, result.total);
  }

  async assignOperator(
    queueId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    // Ensure assigning user (if manager) has access to the site of this queue (§4.10)
    const siteId = await this.queuesRepository.findQueueSiteId(queueId);
    if (siteId == null) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    await this.scopeService.checkSiteAccess(user, siteId);

    // SEC-04 : 1. Vérifier que le targetUser existe et est actif
    const target = await this.queuesRepository.findUserStatus(targetUserId);
    if (!target) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    if (!target.is_active) {
      throw new DoriException('ACCOUNT_LOCKED', { userId: targetUserId });
    }

    // SEC-04 : 2. Vérifier que le targetUser possède bien le rôle 'hotesse' (ou 'operator') actif
    if (!(await this.queuesRepository.hasOperatorRole(targetUserId))) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }

    const now = this.clockService.now();
    await this.queuesRepository.assignOperator(
      queueId,
      targetUserId,
      user.userId,
      now,
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

    await this.queuesRepository.removeOperator(queueId, targetUserId);

    this.scopeService.invalidateUserScope(targetUserId);
    return { queueId, userId: targetUserId, removed: true };
  }
}
