import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import {
  CreateTierDto,
  UpdateTierDto,
  AssociateQueueTierDto,
  UpdateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './dto/tier.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class ServiceTiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  // ---------------------------------------------------------------------------
  // Catalogue Global
  // ---------------------------------------------------------------------------
  async findAllTiers(pagination: PaginationQueryDto) {
    const [items, total] = await Promise.all([
      this.prisma.serviceTier.findMany({
        where: { isActive: true },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { tierId: 'asc' },
      }),
      this.prisma.serviceTier.count({ where: { isActive: true } }),
    ]);

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findTierById(tierId: number) {
    const tier = await this.prisma.serviceTier.findFirst({
      where: { tierId, isActive: true },
    });
    if (!tier) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { tierId });
    return tier;
  }

  async createTier(dto: CreateTierDto) {
    return this.prisma.serviceTier.create({
      data: {
        tierCode: dto.tierCode,
        tierName: dto.tierName,
        description: dto.description,
        isSystem: false,
      },
    });
  }

  async updateTier(tierId: number, dto: UpdateTierDto) {
    const tier = await this.findTierById(tierId);
    return this.prisma.serviceTier.update({
      where: { tierId },
      data: dto,
    });
  }

  async deleteTier(tierId: number) {
    const tier = await this.findTierById(tierId);
    if (tier.isSystem) {
      throw new AppException(ErrorCode.TIER_IS_SYSTEM, { tierId });
    }

    return this.prisma.serviceTier.update({
      where: { tierId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Associations Queue <-> Tier (§3.7, §4.1)
  // ---------------------------------------------------------------------------
  async findTiersByQueue(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queueTiers = await this.prisma.queueServiceTier.findMany({
      where: { queueId, isActive: true },
      include: {
        tier: true,
        notificationRules: {
          where: { isActive: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return queueTiers.map((qt) => ({
      tierId: qt.tierId,
      tierCode: qt.tier.tierCode,
      tierName: qt.tier.tierName,
      isSystem: qt.tier.isSystem,
      price: Number(qt.price),
      currency: qt.currency,
      displayOrder: qt.displayOrder,
      notificationRules: qt.notificationRules,
    }));
  }

  async associateTierToQueue(user: UserContext, queueId: number, dto: AssociateQueueTierDto) {
    await this.scopeService.validateQueueScope(user, queueId);

    const tier = await this.findTierById(dto.tierId);

    return this.prisma.queueServiceTier.upsert({
      where: { queueId_tierId: { queueId, tierId: dto.tierId } },
      update: {
        price: dto.price,
        currency: dto.currency || 'TND',
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      },
      create: {
        queueId,
        tierId: dto.tierId,
        price: dto.price,
        currency: dto.currency || 'TND',
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      },
    });
  }

  async updateQueueTier(
    user: UserContext,
    queueId: number,
    tierId: number,
    dto: UpdateQueueTierDto,
  ) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.queueServiceTier.update({
      where: { queueId_tierId: { queueId, tierId } },
      data: dto,
    });
  }

  async deleteQueueTier(user: UserContext, queueId: number, tierId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const tier = await this.findTierById(tierId);
    if (tier.isSystem || tier.tierCode === 'free') {
      throw new AppException(ErrorCode.TIER_IS_SYSTEM, { tierId });
    }

    return this.prisma.queueServiceTier.update({
      where: { queueId_tierId: { queueId, tierId } },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Règles de notification (§3.8, §4.1)
  // ---------------------------------------------------------------------------
  async findRulesByQueueTier(user: UserContext, queueId: number, tierId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.tierNotificationRule.findMany({
      where: { queueId, tierId, isActive: true },
      orderBy: { ruleId: 'asc' },
    });
  }

  async createNotificationRule(
    user: UserContext,
    queueId: number,
    tierId: number,
    dto: CreateNotificationRuleDto,
  ) {
    await this.scopeService.validateQueueScope(user, queueId);

    // Règle de validation §3.8 : ck_rule_threshold
    if (
      dto.notificationType === 'threshold' &&
      dto.thresholdPosition === undefined &&
      dto.thresholdMinutes === undefined
    ) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: 'Une règle threshold requiert thresholdPosition ou thresholdMinutes',
      });
    }

    return this.prisma.tierNotificationRule.create({
      data: {
        queueId,
        tierId,
        notificationType: dto.notificationType,
        channel: dto.channel,
        thresholdPosition: dto.thresholdPosition,
        thresholdMinutes: dto.thresholdMinutes,
        includeTrackingLink: dto.includeTrackingLink ?? false,
      },
    });
  }

  async updateNotificationRule(
    user: UserContext,
    queueId: number,
    tierId: number,
    ruleId: number,
    dto: UpdateNotificationRuleDto,
  ) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.tierNotificationRule.update({
      where: { ruleId },
      data: dto,
    });
  }

  async deleteNotificationRule(
    user: UserContext,
    queueId: number,
    tierId: number,
    ruleId: number,
  ) {
    await this.scopeService.validateQueueScope(user, queueId);

    return this.prisma.tierNotificationRule.update({
      where: { ruleId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Écran d'affichage salle d'attente (§5.5, §8.4)
  // ---------------------------------------------------------------------------
  async getDisplayScreen(user: UserContext, queueId: number) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));

    // Tickets en cours par guichet
    const inProgressCustomers = await this.prisma.customer.findMany({
      where: {
        queueId,
        businessDate,
        status: 'in_progress',
        isActive: true,
      },
      include: {
        currentSession: true,
      },
    });

    const currentByThread = inProgressCustomers.map((c) => ({
      threadNumber: c.currentSession?.threadNumber || null,
      ticketNumber: c.ticketNumber,
    }));

    // Prochains tickets en attente (ordonnés chronologiquement par priorityReferenceTime)
    const nextWaiting = await this.prisma.customer.findMany({
      where: {
        queueId,
        businessDate,
        status: 'waiting',
        isActive: true,
        OR: [
          { entryType: 'walkin' },
          { entryType: 'appointment', appointmentStatus: 'checked_in' },
        ],
      },
      orderBy: { priorityReferenceTime: 'asc' },
      take: 5,
      select: {
        ticketNumber: true,
      },
    });

    return {
      queueId,
      queueCode: queue.queueCode,
      queueName: queue.queueName,
      currentCalls: currentByThread,
      nextTickets: nextWaiting.map((c) => c.ticketNumber),
    };
  }
}
