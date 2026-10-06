import { Injectable } from '@nestjs/common';
import { OpenQueueSessionDto } from './dto/session.dto';
import { QueueSessionResponseDto } from './dto/engine-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  ActiveThreadSessionRow,
  QueueEngineRepository,
} from './queue-engine.repository';

@Injectable()
export class QueueEngineService {
  constructor(
    private readonly queueEngineRepository: QueueEngineRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly realtimeService: RealtimeService,
  ) {}

  // 1. Threads State (Â§6.1)
  async getThreads(
    queueId: number,
    user: AuthenticatedUser,
    pagination: PaginationDto = new PaginationDto(),
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const state = await this.queueEngineRepository.findThreadState(queueId);
    if (!state) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    const { threadCount, sessions: activeSessions } = state;
    const now = this.clockService.now();
    const sessionByThread = new Map<number, ActiveThreadSessionRow>();
    for (const s of activeSessions) {
      if (s.thread_number) {
        sessionByThread.set(s.thread_number, s);
      }
    }

    const items: Array<Record<string, unknown>> = [];
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

  // 2. Open or Take Over Session (Â§6.2, Â§4.6)
  async openSession(
    queueId: number,
    dto: OpenQueueSessionDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();
    const mode = dto.mode || 'active';

    if (mode === 'consultation_only') {
      let session;
      try {
        session = await this.queueEngineRepository.createSession({
          queueId,
          userId: user.userId,
          threadNumber: null,
          mode: 'consultation_only',
          now,
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new DoriException('SESSION_ALREADY_OPEN');
        }
        throw error;
      }
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

    const threadCount =
      await this.queueEngineRepository.findThreadCount(queueId);
    if (threadCount == null) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    if (dto.threadNumber < 1 || dto.threadNumber > threadCount) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [`threadNumber must be between 1 and ${threadCount}`],
        },
      );
    }

    // Check if current user already has an active session on this queue (Â§3.9, Â§6.9)
    const existingUserSession =
      await this.queueEngineRepository.findActiveUserSession(
        queueId,
        user.userId,
      );

    if (existingUserSession) {
      // If user is already on the exact same thread requested, return existing session
      if (existingUserSession.thread_number === dto.threadNumber) {
        return {
          sessionId: existingUserSession.session_id,
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
    const occupied = await this.queueEngineRepository.findOccupiedThread(
      queueId,
      dto.threadNumber,
    );

    if (occupied) {
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

      // Take over in single transaction (Â§4.6, Â§7.6)
      const takeover = await this.queueEngineRepository.takeOverThread({
        queueId,
        threadNumber: dto.threadNumber,
        userId: user.userId,
        now,
      });
      if (!takeover) throw new DoriException('THREAD_UNAVAILABLE');
      return {
        sessionId: takeover.session.session_id,
        queueId: takeover.session.queue_id,
        userId: takeover.session.user_id,
        threadNumber: takeover.session.thread_number,
        mode: 'active',
        connectedAt: takeover.session.connected_at,
        takenOverFromSessionId: takeover.previousSessionId,
        reassignedRegistrationId: takeover.reassignedRegistrationId,
      };
    }

    // Thread is free, open directly
    let session;
    try {
      session = await this.queueEngineRepository.createSession({
        queueId,
        userId: user.userId,
        threadNumber: dto.threadNumber,
        mode: 'active',
        now,
      });
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

  // 3. Close Session (Â§4.6)
  async closeSession(
    queueId: number,
    sessionId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    await this.queueEngineRepository.closeSession(
      queueId,
      sessionId,
      user.userId,
      now,
    );

    return { sessionId, closed: true };
  }

  // 4. Next Client Call (Â§6.3, Â§4.4, Â§7.6)
  async next(queueId: number, user: AuthenticatedUser) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();
    const context = await this.queueEngineRepository.findCallContext(
      queueId,
      user.userId,
    );
    if (!context.session) throw new DoriException('THREAD_UNAVAILABLE');
    if (!context.config)
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    const businessDate = this.clockService.todayInTimezone(
      context.config.timezone,
    );
    const candidate = await this.queueEngineRepository.callNext({
      queueId,
      sessionId: context.session.session_id,
      businessDate,
      now,
      baseWalkin: context.config.baseWalkin,
      baseAppointment: context.config.baseAppointment,
      rateWalkin: context.config.rateWalkin,
      rateAppointment: context.config.rateAppointment,
    });
    if (!candidate) throw new DoriException('QUEUE_EMPTY');
    const result = {
      registrationId: candidate.registration_id,
      ticketNumber: candidate.ticket_number,
      entryType: candidate.entry_type,
      scheduledTime: candidate.scheduled_time,
      calledEarly: candidate.called_early,
      tier: {
        tierId: candidate.tier_id,
        tierCode: candidate.tier_code,
        tierName: candidate.tier_name,
      },
      status: candidate.status,
      sessionId: context.session.session_id,
      threadNumber: context.session.thread_number,
      priorityScore: candidate.score,
      calledAt: candidate.called_at,
      person: {
        personId: candidate.person_id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        phone: candidate.phone_number,
        hasNotes: candidate.notes_count > 0,
      },
      trackingToken: candidate.registration_tracking_token,
    };
    this.realtimeService.emitQueueOps(queueId, 'registration_called', result);
    this.realtimeService.emitQueueDisplay(queueId, 'registration_called', {
      ticketNumber: result.ticketNumber,
      threadNumber: result.threadNumber ?? undefined,
    });
    this.realtimeService.emitRegistrationUpdate(result.trackingToken, {
      ticketNumber: result.ticketNumber,
      status: result.status,
    });
    const { trackingToken: _trackingToken, ...response } = result;
    return response;
  }

  // 5. Close Registration Served / No-Show
  async markServed(registrationId: number, user: AuthenticatedUser) {
    const now = this.clockService.now();

    // Verify registration is in_progress on a session owned by caller (Â§6.4)
    const reg =
      await this.queueEngineRepository.findInProgressRegistration(
        registrationId,
      );
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_IN_PROGRESS', {
        status: 'waiting',
      });
    }

    if (reg.session_user_id !== user.userId) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    await this.queueEngineRepository.closeRegistration(
      registrationId,
      'served',
      now,
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

    const reg =
      await this.queueEngineRepository.findInProgressRegistration(
        registrationId,
      );
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_IN_PROGRESS', {
        status: 'waiting',
      });
    }

    if (reg.session_user_id !== user.userId) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    // no-show is terminal and sets is_active = FALSE (Â§4.7)
    await this.queueEngineRepository.closeRegistration(
      registrationId,
      'no_show',
      now,
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

  // Active supervision sessions (Â§5.8)
  async getSessions(
    queueId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueSessionResponseDto>> {
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

    const result = await this.queueEngineRepository.findSessionPage({
      queueId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });
    return pagination.createResponse<QueueSessionResponseDto>(
      result.items.map((session) => ({
        sessionId: session.session_id,
        queueId: session.queue_id,
        userId: session.user_id,
        username: session.username,
        threadNumber: session.thread_number,
        mode: session.mode,
        connectedAt: session.connected_at,
        disconnectedAt: session.disconnected_at,
      })) as QueueSessionResponseDto[],
      result.total,
    );
  }

  // 6. Next Preview (Â§10.2)
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
    let targetQueueIds: number[];
    if (queueId) {
      if (user) await this.scopeService.checkQueueAccess(user, queueId);
      targetQueueIds = [queueId];
    } else if (siteId) {
      if (user) await this.scopeService.checkSiteAccess(user, siteId);
      targetQueueIds = await this.queueEngineRepository.findQueueIds(siteId);
    } else {
      targetQueueIds = scope.isGlobal
        ? await this.queueEngineRepository.findQueueIds()
        : scope.queueIds;
    }
    if (!targetQueueIds.length) return [];
    const candidates = await this.queueEngineRepository.findPreviewCandidates(
      targetQueueIds,
      now,
      limit,
    );
    return candidates.map((candidate) => ({
      registrationId: candidate.registration_id,
      ticketNumber: candidate.ticket_number,
      queueId: candidate.queue_id,
      queueCode: candidate.queue_code,
      queueName: candidate.queue_name,
      siteName: candidate.site_name,
      entryType: candidate.entry_type,
      scheduledTime: candidate.scheduled_time,
      priorityScore: Number(candidate.score ?? 0),
      calledEarly: candidate.called_early,
      person: {
        personId: candidate.person_id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
      },
    }));
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
  ): Promise<PaginatedResult<QueueSessionResponseDto>> {
    return this.getSessions(queueId, paginationOrUser, maybeUser);
  }

  async callNext(queueId: number, user: AuthenticatedUser) {
    return this.next(queueId, user);
  }
}
