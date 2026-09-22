import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { CreateQueueDto, UpdateQueueDto } from './dto/queue.dto';
import { resolveQueueConfig } from './queue-config.helper';

@Injectable()
export class QueuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Création d'une file d'attente (avec association automatique obligatoire au forfait 'free' - §3.7)
   */
  async create(siteId: number, dto: CreateQueueDto) {
    const site = await this.prisma.site.findUnique({ where: { siteId, isActive: true } });
    if (!site) throw new AppException(ErrorCode.SITE_NOT_FOUND, { siteId });

    // Récupération du forfait système 'free'
    const freeTier = await this.prisma.serviceTier.findUnique({ where: { tierCode: 'free' } });
    if (!freeTier) throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, { error: 'Forfait free introuvable' });

    return this.prisma.$transaction(async (tx) => {
      const queue = await tx.queue.create({
        data: {
          siteId,
          queueCode: dto.queueCode,
          queueName: dto.queueName,
          averageWaitTime: dto.averageWaitTime ?? 10,
          threadCount: dto.threadCount ?? 1,
          appointmentsEnabled: dto.appointmentsEnabled,
          appointmentSlotDuration: dto.appointmentSlotDuration,
          slotCapacity: dto.slotCapacity,
          workingHoursStart: dto.workingHoursStart,
          workingHoursEnd: dto.workingHoursEnd,
          breakStart: dto.breakStart,
          breakEnd: dto.breakEnd,
          lateToleranceMinutes: dto.lateToleranceMinutes,
          baseWeightWalkin: dto.baseWeightWalkin,
          baseWeightAppointment: dto.baseWeightAppointment,
          escalationRateWalkin: dto.escalationRateWalkin,
          escalationRateAppointment: dto.escalationRateAppointment,
          carryOverWaiting: dto.carryOverWaiting,
          dailyResetMode: dto.dailyResetMode,
          dailyResetTime: dto.dailyResetTime,
        },
      });

      // Invariant applicatif §3.7 : association automatique et indestructible au forfait 'free'
      await tx.queueServiceTier.create({
        data: {
          queueId: queue.queueId,
          tierId: freeTier.tierId,
          price: 0,
          currency: site.defaultCurrency,
          displayOrder: 0,
          isActive: true,
        },
      });

      return queue;
    });
  }

  async findById(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findFirst({
      where: { queueId, isActive: true },
      include: { site: true },
    });

    if (!queue) {
      throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });
    }

    return resolveQueueConfig(queue, queue.site);
  }

  async findBySite(user: UserContext, siteId: number) {
    await this.scopeService.validateSiteScope(user, siteId);
    const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);

    const whereClause: any = { siteId, isActive: true };
    if (allowedQueueIds !== null) {
      whereClause.queueId = { in: allowedQueueIds };
    }

    const queues = await this.prisma.queue.findMany({
      where: whereClause,
      include: { site: true },
      orderBy: { queueCode: 'asc' },
    });

    return queues.map((q) => resolveQueueConfig(q, q.site));
  }

  async update(user: UserContext, queueId: number, dto: UpdateQueueDto) {
    await this.scopeService.validateQueueScope(user, queueId);

    const updated = await this.prisma.queue.update({
      where: { queueId },
      data: dto,
      include: { site: true },
    });

    return resolveQueueConfig(updated, updated.site);
  }

  async delete(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.queue.update({
      where: { queueId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });
  }

  /**
   * Statut temps réel de la file (§5.4)
   */
  async getStatus(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));

    // Comptage des clients en attente pour la journée métier
    const waitingCount = await this.prisma.customer.count({
      where: {
        queueId,
        businessDate,
        status: 'waiting',
        isActive: true,
      },
    });

    // Sessions actives
    const activeSessions = await this.prisma.queueSession.findMany({
      where: {
        queueId,
        disconnectedAt: null,
        mode: 'active',
      },
    });

    const activeThreadsCount = Math.max(1, activeSessions.length);
    const estimatedWaitMinutes = Math.round((waitingCount * queue.averageWaitTime) / activeThreadsCount);

    // Prochains rendez-vous de la journée
    const nextAppointments = await this.prisma.customer.findMany({
      where: {
        queueId,
        businessDate,
        entryType: 'appointment',
        appointmentStatus: { in: ['booked', 'checked_in'] },
        isActive: true,
      },
      orderBy: { scheduledTime: 'asc' },
      take: 5,
      select: {
        customerId: true,
        ticketNumber: true,
        scheduledTime: true,
        appointmentStatus: true,
        status: true,
      },
    });

    return {
      queueId,
      queueCode: queue.queueCode,
      waitingCount,
      activeThreadsCount,
      totalThreads: queue.threadCount,
      estimatedWaitMinutes,
      nextAppointments,
    };
  }

  /**
   * État des guichets conforme au contrat figé §6.1
   */
  async getThreads(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({ where: { queueId } });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    // Récupération des sessions actives sur les guichets de cette file
    const activeSessions = await this.prisma.queueSession.findMany({
      where: {
        queueId,
        disconnectedAt: null,
        mode: 'active',
        threadNumber: { not: null },
      },
      include: {
        user: { select: { userId: true, username: true } },
        customers: {
          where: { status: 'in_progress', isActive: true },
          select: { customerId: true },
          take: 1,
        },
      },
    });

    const sessionByThread = new Map<number, any>();
    activeSessions.forEach((s) => {
      if (s.threadNumber) sessionByThread.set(s.threadNumber, s);
    });

    const now = this.clockService.now();
    const threads = [];

    for (let t = 1; t <= queue.threadCount; t++) {
      const session = sessionByThread.get(t);
      if (!session) {
        threads.push({
          threadNumber: t,
          status: 'free',
          session: null,
        });
      } else {
        const inactiveMinutes = this.clockService.diffInMinutes(now, session.lastSeenAt);
        const currentRegId = session.customers.length > 0 ? session.customers[0].customerId : null;

        threads.push({
          threadNumber: t,
          status: 'occupied',
          session: {
            sessionId: session.sessionId,
            userId: session.user.userId,
            username: session.user.username,
            connectedAt: session.connectedAt.toISOString(),
            lastSeenAt: session.lastSeenAt.toISOString(),
            inactiveMinutes,
            currentRegistrationId: currentRegId,
          },
        });
      }
    }

    return {
      queueId: queue.queueId,
      threadCount: queue.threadCount,
      threads,
    };
  }

  async getOperators(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const userQueues = await this.prisma.userQueue.findMany({
      where: { queueId },
      include: {
        user: {
          select: {
            userId: true,
            username: true,
            email: true,
            userType: true,
          },
        },
      },
    });

    return userQueues.map((uq) => uq.user);
  }

  async assignOperator(user: UserContext, queueId: number, targetUserId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.userQueue.upsert({
      where: { userId_queueId: { userId: targetUserId, queueId } },
      update: {},
      create: { userId: targetUserId, queueId },
    });
  }

  async unassignOperator(user: UserContext, queueId: number, targetUserId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    await this.prisma.userQueue.deleteMany({
      where: { userId: targetUserId, queueId },
    });

    return { success: true };
  }
}
