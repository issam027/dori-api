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
import {
  ActiveThreadSessionRow,
  NextCandidateRow,
  QueueEngineRepository,
} from './queue-engine.repository';
import { CockpitQueryDto } from './dto/cockpit-query.dto';

@Injectable()
export class QueueEngineService {
  constructor(
    private readonly queueEngineRepository: QueueEngineRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  // 1. Threads State (Â§6.1)
  async getThreads(
    queueId: string,
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
            counterName: s.counter_name,
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
    queueId: string,
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
          counterName: dto.counterName ?? null,
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
        counterName: session.counter_name,
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
          counterName: existingUserSession.counter_name,
          mode: 'active',
          connectedAt: existingUserSession.connected_at,
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
      if (!dto.takeOver && !dto.replaceSessionId) {
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
      if (
        dto.replaceSessionId &&
        dto.replaceSessionId !== occupied.session_id
      ) {
        throw new DoriException('THREAD_UNAVAILABLE', {
          threadNumber: dto.threadNumber,
        });
      }

      // Take over in single transaction (Â§4.6, Â§7.6)
      const takeover = await this.queueEngineRepository.takeOverThread({
        queueId,
        threadNumber: dto.threadNumber,
        counterName: dto.counterName ?? occupied.counter_name ?? null,
        userId: user.userId,
        expectedPreviousSessionId: dto.replaceSessionId,
        now,
      });
      if (!takeover) throw new DoriException('THREAD_UNAVAILABLE');
      return {
        sessionId: takeover.session.session_id,
        queueId: takeover.session.queue_id,
        userId: takeover.session.user_id,
        threadNumber: takeover.session.thread_number,
        counterName: takeover.session.counter_name,
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
        counterName: dto.counterName ?? null,
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
      counterName: session.counter_name,
      mode: 'active',
      connectedAt: session.connected_at,
      takenOverFromSessionId: null,
      reassignedRegistrationId: null,
    };
  }

  // 3. Close Session (Â§4.6)
  async closeSession(
    queueId: string,
    sessionId: string,
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
  async next(queueId: string, user: AuthenticatedUser) {
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
      userId: user.userId,
      businessDate,
      now,
      baseWalkin: context.config.baseWalkin,
      baseAppointment: context.config.baseAppointment,
      rateWalkin: context.config.rateWalkin,
      rateAppointment: context.config.rateAppointment,
    });
    if (!candidate) {
      throw new DoriException('QUEUE_EMPTY', { queueId });
    }
    return this.mapCalledCandidate(candidate, context.session);
  }

  async nextForSite(siteId: string, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const scope = await this.scopeService.getUserScope(user);
    const result = await this.queueEngineRepository.callNextForSite({
      siteId,
      userId: user.userId,
      allowedQueueIds: scope.isGlobal ? null : scope.queueIds,
      now: this.clockService.now(),
    });
    if (result.outcome === 'no_session') {
      throw new DoriException('THREAD_UNAVAILABLE');
    }
    if (result.outcome === 'empty') {
      throw new DoriException('QUEUE_EMPTY', { siteId });
    }
    if (result.outcome !== 'called') {
      throw new DoriException('INTERNAL_ERROR');
    }
    return {
      ...this.mapCalledCandidate(result.candidate, result.candidate),
      queue: {
        queueId: result.candidate.queue_id,
        queueName: result.candidate.queue_name,
      },
    };
  }

  private mapCalledCandidate(
    candidate: NextCandidateRow,
    session: { session_id: string; thread_number: number | null },
  ) {
    return {
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
      sessionId: session.session_id,
      threadNumber: session.thread_number,
      priorityScore: candidate.score,
      calledAt: candidate.called_at,
      person: {
        personId: candidate.person_id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        phone: candidate.phone_number,
        hasNotes: candidate.notes_count > 0,
      },
    };
  }

  // 5. Close Registration Served / No-Show
  async markServed(registrationId: string, user: AuthenticatedUser) {
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
      handledBySessionId: reg.served_by_session_id,
      handledByUserId: user.userId,
    };
  }

  async markNoShow(registrationId: string, user: AuthenticatedUser) {
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

    // no-show is a terminal business status; it does not soft-delete the registration.
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
      handledBySessionId: reg.served_by_session_id,
      handledByUserId: user.userId,
    };
  }

  async recall(registrationId: string, user: AuthenticatedUser) {
    const result = await this.queueEngineRepository.recallRegistration({
      registrationId,
      userId: user.userId,
      now: this.clockService.now(),
    });

    if (result.outcome === 'not_found') {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }
    if (result.outcome === 'not_in_progress') {
      throw new DoriException('REGISTRATION_NOT_IN_PROGRESS');
    }
    if (result.outcome === 'session_unavailable') {
      throw new DoriException('SESSION_NOT_FOUND');
    }
    if (result.outcome === 'forbidden') {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }
    if (result.outcome !== 'recalled') {
      throw new DoriException('INTERNAL_ERROR');
    }

    return {
      registrationId: result.registration_id,
      queueId: result.queue_id,
      ticketNumber: result.ticket_number,
      status: result.status,
      sessionId: result.session_id,
      threadNumber: result.thread_number,
      counterName: result.counter_name,
      lastRecalledAt: result.last_recalled_at,
      recallCount: result.recall_count,
    };
  }

  // Active supervision sessions (Â§5.8)
  async getSessions(
    queueId: string,
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
        'qs.counter_name',
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
      result.items.map((session): QueueSessionResponseDto => ({
        sessionId: session.session_id,
        queueId: session.queue_id,
        userId: session.user_id,
        username: session.username,
        threadNumber: session.thread_number,
        counterName: session.counter_name,
        mode: session.mode,
        connectedAt: session.connected_at,
        disconnectedAt: session.disconnected_at,
      })),
      result.total,
    );
  }

  // 6. Next Preview (Â§10.2)
  async nextPreview(
    limit: number = 6,
    siteId?: string,
    queueId?: string,
    user?: AuthenticatedUser,
  ) {
    const scope = user
      ? await this.scopeService.getUserScope(user)
      : { isGlobal: true, siteIds: [], queueIds: [] };
    const now = this.clockService.now();
    let targetQueueIds: string[];
    if (queueId) {
      if (user) await this.scopeService.checkQueueAccess(user, queueId);
      targetQueueIds = [queueId];
    } else if (siteId) {
      if (user) await this.scopeService.checkSiteAccess(user, siteId);
      targetQueueIds = await this.queueEngineRepository.findQueueIds(siteId);
      if (!scope.isGlobal) {
        const allowedQueueIds = new Set(scope.queueIds);
        targetQueueIds = targetQueueIds.filter((id) => allowedQueueIds.has(id));
      }
    } else {
      targetQueueIds = scope.isGlobal
        ? await this.queueEngineRepository.findQueueIds()
        : scope.queueIds;
    }
    if (user && targetQueueIds.length) {
      targetQueueIds =
        await this.queueEngineRepository.findActiveQueueIdsForUser(
          targetQueueIds,
          user.userId,
        );
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

  async getCockpit(
    siteId: string,
    query: CockpitQueryDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const scope = await this.scopeService.getUserScope(user);
    const siteQueueIds = await this.queueEngineRepository.findQueueIds(siteId);
    const authorizedQueueIds = scope.isGlobal
      ? siteQueueIds
      : siteQueueIds.filter((queueId) => scope.queueIds.includes(queueId));
    if (
      query.queueIds?.some((queueId) => !authorizedQueueIds.includes(queueId))
    ) {
      throw new DoriException('QUEUE_NOT_FOUND');
    }
    const queueIds = query.queueIds ?? authorizedQueueIds;
    const now = this.clockService.now();
    const data = await this.queueEngineRepository.getCockpitData({
      siteId,
      queueIds,
      userId: user.userId,
      now,
      previewLimit: query.previewLimit,
      recentLimit: query.recentLimit,
    });
    if (!data.site) throw new DoriException('SITE_NOT_FOUND', { siteId });

    const sessionsByQueue = new Map<string, Array<Record<string, unknown>>>();
    for (const session of data.sessions) {
      const queueId = String(session.queue_id);
      const sessions = sessionsByQueue.get(queueId) ?? [];
      sessions.push(session);
      sessionsByQueue.set(queueId, sessions);
    }
    const activeCallByQueue = new Map(
      data.activeCalls.map((call) => [String(call.queue_id), call]),
    );
    const candidatesByQueue = new Map<string, Array<Record<string, unknown>>>();
    for (const candidate of data.candidates) {
      const queueId = String(candidate.queue_id);
      const candidates = candidatesByQueue.get(queueId) ?? [];
      candidates.push(candidate);
      candidatesByQueue.set(queueId, candidates);
    }
    const canOpenSession = user.permissions.includes('session_operate');
    return {
      siteId: String(data.site.site_id),
      siteName: String(data.site.site_name),
      serverTime: now,
      operator: {
        userId: user.userId,
        username: user.username,
        displayName: data.operator?.full_name
          ? String(data.operator.full_name)
          : null,
      },
      queues: data.queues.map((queue) => {
        const queueId = String(queue.queue_id);
        const sessions = sessionsByQueue.get(queueId) ?? [];
        const ownedSession = sessions.find(
          (session) => String(session.user_id) === user.userId,
        );
        const activeCall = activeCallByQueue.get(queueId);
        const threadCount = Number(queue.thread_count);
        const occupiedThreadNumbers = new Set(
          sessions.map((session) => Number(session.thread_number)),
        );
        const availableThreadNumbers = Array.from(
          { length: threadCount },
          (_, index) => index + 1,
        ).filter((threadNumber) => !occupiedThreadNumbers.has(threadNumber));
        const waitingCount = Number(queue.waiting_count ?? 0);
        const activeThreads = Number(queue.occupied_threads_count ?? 0);
        const cycleMinutes = Number(
          queue.cycle_p50_minutes ?? queue.average_wait_time ?? 0,
        );
        const estimatedWaitMinutes =
          activeThreads === 0
            ? null
            : waitingCount === 0
              ? 0
              : Math.max(
                  1,
                  Math.round(
                    (waitingCount * cycleMinutes) / activeThreads / 5,
                  ) * 5,
                );
        return {
          queueId,
          queueCode: String(queue.queue_code),
          queueName: String(queue.queue_name),
          waitingCount,
          remainingAppointmentsCount: Number(
            queue.remaining_appointments_count ?? 0,
          ),
          estimatedWaitMinutes,
          threadCount,
          occupiedThreadsCount: activeThreads,
          availableThreadNumbers,
          sessions: sessions.map((session) => ({
            sessionId: String(session.session_id),
            threadNumber: Number(session.thread_number),
            counterName: session.counter_name
              ? String(session.counter_name)
              : null,
            operatorName: String(session.operator_name),
            ownedByCurrentOperator: String(session.user_id) === user.userId,
          })),
          currentOperatorSessionId: ownedSession
            ? String(ownedSession.session_id)
            : null,
          sessionOpening: {
            allowed: canOpenSession,
            availableThreadNumbers,
            requiresReplacement:
              canOpenSession && availableThreadNumbers.length === 0,
            replaceableSessions: sessions.map((session) => ({
              sessionId: String(session.session_id),
              threadNumber: Number(session.thread_number),
              counterName: session.counter_name
                ? String(session.counter_name)
                : null,
              operatorName: String(session.operator_name),
            })),
          },
          centralizedNext: {
            eligible: Boolean(ownedSession && !activeCall),
            unavailableReason: !ownedSession
              ? 'no_session'
              : activeCall
                ? 'active_call_in_progress'
                : null,
          },
          activeCall: activeCall
            ? {
                registrationId: String(activeCall.registration_id),
                ticketNumber: String(activeCall.ticket_number),
                status: 'in_progress',
                entryType: String(activeCall.entry_type),
                scheduledTime: activeCall.scheduled_time ?? null,
                calledAt: activeCall.called_at,
                recallCount: Number(activeCall.recall_count ?? 0),
                lastRecalledAt: activeCall.last_recalled_at ?? null,
                person: {
                  personId: String(activeCall.person_id),
                  firstName: activeCall.first_name ?? null,
                  lastName: activeCall.last_name ?? null,
                },
                tier: {
                  tierId: String(activeCall.tier_id),
                  tierCode: String(activeCall.tier_code),
                  tierName: String(activeCall.tier_name),
                },
                notesCount: Number(activeCall.notes_count ?? 0),
              }
            : null,
          nextCandidates: (candidatesByQueue.get(queueId) ?? []).map(
            (candidate) => ({
              ticketNumber: String(candidate.ticket_number),
              entryType: String(candidate.entry_type),
              scheduledTime: candidate.scheduled_time ?? null,
              priorityReferenceTime: candidate.priority_reference_time,
              priorityScore: Number(candidate.score ?? 0),
              calledEarly: Boolean(candidate.called_early),
              tier: {
                tierId: String(candidate.tier_id),
                tierCode: String(candidate.tier_code),
                tierName: String(candidate.tier_name),
              },
            }),
          ),
        };
      }),
      recentPassages: data.recentPassages.map((passage) => ({
        registrationId: String(passage.registration_id),
        queueId: String(passage.queue_id),
        queueName: String(passage.queue_name),
        ticketNumber: String(passage.ticket_number),
        personName: String(passage.person_name),
        threadNumber:
          passage.thread_number == null ? null : Number(passage.thread_number),
        counterName: passage.counter_name ? String(passage.counter_name) : null,
        calledAt: passage.called_at,
        closedAt: passage.closed_at,
        outcome: String(passage.outcome),
      })),
    };
  }

  async previewNext(
    user: AuthenticatedUser,
    siteId?: string,
    limit?: number,
    queueId?: string,
  ) {
    return this.nextPreview(limit ?? 10, siteId, queueId, user);
  }

  async getThreadsStatus(
    queueId: string,
    user: AuthenticatedUser,
    pagination?: PaginationDto,
  ) {
    return this.getThreads(queueId, user, pagination);
  }

  async getActiveSessions(
    queueId: string,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueSessionResponseDto>> {
    return this.getSessions(queueId, paginationOrUser, maybeUser);
  }

  async callNext(queueId: string, user: AuthenticatedUser) {
    return this.next(queueId, user);
  }
}
