import { Injectable } from '@nestjs/common';
import {
  CreateTierDto,
  UpdateTierDto,
  AssociateQueueTierDto,
  UpdateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './dto/service-tier.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import {
  QueueTierResponseDto,
  ServiceTierResponseDto,
} from './dto/tier-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { ServiceTiersRepository } from './service-tiers.repository';

@Injectable()
export class ServiceTiersService {
  constructor(
    private readonly serviceTiersRepository: ServiceTiersRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  private validateNotificationRule(rule: {
    notificationType: 'welcome' | 'threshold';
    thresholdType?: 'position' | 'estimatedTime' | null;
    thresholdValue?: number | null;
  }) {
    const hasThreshold =
      rule.thresholdType != null && rule.thresholdValue != null;
    if (rule.notificationType === 'threshold' && !hasThreshold) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: ['Threshold rules require thresholdType and thresholdValue'],
        },
      );
    }
    if (
      rule.notificationType === 'welcome' &&
      (rule.thresholdType != null || rule.thresholdValue != null)
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['Welcome rules cannot define a threshold'] },
      );
    }
  }

  private toNotificationRuleResponse(rule: {
    rule_id: number;
    queue_id: number;
    tier_id: number;
    notification_type: 'welcome' | 'threshold';
    channel: string;
    threshold_position?: number | null;
    threshold_minutes?: number | null;
    include_tracking_link: boolean;
    is_active: boolean;
  }) {
    return {
      ruleId: rule.rule_id,
      queueId: rule.queue_id,
      tierId: rule.tier_id,
      notificationType: rule.notification_type,
      channel: rule.channel,
      thresholdType:
        rule.threshold_position != null
          ? ('position' as const)
          : rule.threshold_minutes != null
            ? ('estimatedTime' as const)
            : null,
      thresholdValue: rule.threshold_position ?? rule.threshold_minutes ?? null,
      includeTrackingLink: rule.include_tracking_link,
      isActive: rule.is_active,
    };
  }

  private async getQueueTierRepresentation(queueId: number, tierId: number) {
    const row = await this.serviceTiersRepository.findQueueTier(
      queueId,
      tierId,
    );
    if (!row) throw new DoriException('TIER_NOT_FOUND', { tierId });
    return {
      queueId: row.queue_id,
      tierId: row.tier_id,
      price: Number(row.price),
      currency: row.currency,
      currencyOverride: row.currency_override ?? null,
      currencyOrigin: row.currency_origin,
      isActive: row.is_active,
      isDefault: row.is_default,
      displayOrder: row.display_order,
      tier: {
        tierId: row.tier_id,
        tierCode: row.tier_code,
        tierName: row.tier_name,
        description: row.description,
        isSystem: row.is_system,
        isActive: row.is_active,
      },
    };
  }

  // 1. Global catalog
  async findTiers(
    pagination: PaginationDto,
    _user?: AuthenticatedUser,
  ): Promise<PaginatedResult<ServiceTierResponseDto>> {
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const safeSortField = pagination.getSafeSortField(
      ['tier_id', 'tier_name', 'tier_code', 'created_at', 'updated_at'],
      'tier_id',
    );
    const result = await this.serviceTiersRepository.findTierPage({
      sortField: safeSortField,
      sortOrder,
      pageSize,
      offset,
    });
    return pagination.createResponse<ServiceTierResponseDto>(
      result.items as unknown as ServiceTierResponseDto[],
      result.total,
    );
  }

  async findTierById(tierId: number, _user?: AuthenticatedUser) {
    const tier = await this.serviceTiersRepository.findActiveTier(tierId);
    if (!tier) {
      throw new DoriException('TIER_NOT_FOUND', { tierId });
    }
    return tier;
  }

  async createTier(dto: CreateTierDto, user: AuthenticatedUser) {
    const now = this.clockService.now();
    return this.serviceTiersRepository.createTier({
      ...dto,
      userId: user.userId,
      now,
    });
  }

  async updateTier(
    tierId: number,
    dto: UpdateTierDto,
    user: AuthenticatedUser,
  ) {
    await this.findTierById(tierId);
    const now = this.clockService.now();

    return this.serviceTiersRepository.updateTier(
      tierId,
      dto,
      user.userId,
      now,
    );
  }

  async deleteTier(tierId: number, user: AuthenticatedUser) {
    const tier = await this.findTierById(tierId);
    if (tier.is_system) {
      throw new DoriException('TIER_IS_SYSTEM', { tierId });
    }

    const now = this.clockService.now();
    await this.serviceTiersRepository.softDeleteTier(tierId, user.userId, now);

    return { tierId, deleted: true };
  }

  async findQueueTiers(
    queueId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueTierResponseDto>> {
    await this.scopeService.checkQueueAccess(user, queueId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['display_order', 'tier_id', 'price', 'created_at'],
      'display_order',
    );

    const result = await this.serviceTiersRepository.findQueueTierPage({
      queueId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });

    const formattedItems = result.items.map((qt) => ({
      queueId: qt.queue_id,
      tierId: qt.tier_id,
      price: Number(qt.price),
      currency: qt.currency,
      currencyOverride: qt.currency_override ?? null,
      currencyOrigin: qt.currency_origin,
      isActive: qt.is_active,
      isDefault: qt.is_default,
      displayOrder: qt.display_order,
      tier: {
        tierId: qt.tier_id,
        tierCode: qt.tier_code,
        tierName: qt.tier_name,
        description: qt.tier_description,
        isSystem: qt.is_system,
        isActive: qt.is_active,
      },
    }));

    return pagination.createResponse<QueueTierResponseDto>(
      formattedItems,
      result.total,
    );
  }

  async associateQueueTier(
    queueId: number,
    dto: AssociateQueueTierDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    await this.findTierById(dto.tierId);
    const now = this.clockService.now();

    await this.serviceTiersRepository.upsertQueueTier(
      queueId,
      dto,
      user.userId,
      now,
    );

    return this.getQueueTierRepresentation(queueId, dto.tierId);
  }

  async updateQueueTier(
    queueId: number,
    tierId: number,
    dto: UpdateQueueTierDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const tier = await this.findTierById(tierId);
    const now = this.clockService.now();

    // System free tier invariants (§3.7, §5.5): cannot deactivate free tier
    if (tier.is_system && dto.isActive === false) {
      throw new DoriException('TIER_IS_SYSTEM', { tierId });
    }

    await this.serviceTiersRepository.updateQueueTier(
      queueId,
      tierId,
      dto,
      user.userId,
      now,
    );

    return this.getQueueTierRepresentation(queueId, tierId);
  }

  async removeQueueTier(
    queueId: number,
    tierId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const tier = await this.findTierById(tierId);
    if (tier.is_system) {
      // Invariant §3.7: free tier can never be deactivated or deleted
      throw new DoriException('TIER_IS_SYSTEM', { tierId });
    }

    const now = this.clockService.now();
    await this.serviceTiersRepository.removeQueueTier(
      queueId,
      tierId,
      user.userId,
      now,
    );

    return { queueId, tierId, removed: true };
  }

  // 3. Notification Rules
  async findNotificationRules(
    queueId: number,
    tierId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['rule_id', 'created_at', 'updated_at'],
      'rule_id',
    );

    const result = await this.serviceTiersRepository.findNotificationRulePage({
      queueId,
      tierId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });
    return pagination.createResponse(
      result.items.map((rule) => this.toNotificationRuleResponse(rule)),
      result.total,
    );
  }

  async createNotificationRule(
    queueId: number,
    tierId: number,
    dto: CreateNotificationRuleDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    this.validateNotificationRule(dto);
    const rule = await this.serviceTiersRepository.createNotificationRule(
      queueId,
      tierId,
      dto,
      user.userId,
      now,
    );
    return this.toNotificationRuleResponse(rule);
  }

  async updateNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
    dto: UpdateNotificationRuleDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    const current = await this.serviceTiersRepository.findNotificationRule(
      queueId,
      tierId,
      ruleId,
    );
    if (!current) {
      throw new DoriException('NOTIFICATION_NOT_FOUND', {
        notificationId: ruleId,
      });
    }
    const notificationType = dto.notificationType ?? current.notification_type;
    const currentThresholdType =
      current.threshold_position != null
        ? ('position' as const)
        : current.threshold_minutes != null
          ? ('estimatedTime' as const)
          : null;
    const thresholdType =
      notificationType === 'welcome'
        ? (dto.thresholdType ?? null)
        : dto.thresholdType !== undefined
          ? dto.thresholdType
          : currentThresholdType;
    const thresholdValue =
      notificationType === 'welcome'
        ? (dto.thresholdValue ?? null)
        : dto.thresholdValue !== undefined
          ? dto.thresholdValue
          : (current.threshold_position ?? current.threshold_minutes ?? null);
    this.validateNotificationRule({
      notificationType,
      thresholdType,
      thresholdValue,
    });

    const rule = await this.serviceTiersRepository.updateNotificationRule(
      queueId,
      tierId,
      ruleId,
      {
        notificationType,
        channel: dto.channel,
        thresholdPosition: thresholdType === 'position' ? thresholdValue : null,
        thresholdMinutes:
          thresholdType === 'estimatedTime' ? thresholdValue : null,
        includeTrackingLink: dto.includeTrackingLink,
        isActive: dto.isActive,
      },
      user.userId,
      now,
    );
    return this.toNotificationRuleResponse(rule);
  }

  async deleteNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    await this.serviceTiersRepository.softDeleteNotificationRule(
      queueId,
      tierId,
      ruleId,
      user.userId,
      now,
    );

    return { ruleId, deleted: true };
  }

  async getQueueTiers(
    queueId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<QueueTierResponseDto>> {
    let pagination: PaginationDto;
    let user: AuthenticatedUser;

    if (paginationOrUser && 'userId' in paginationOrUser) {
      user = paginationOrUser as AuthenticatedUser;
      pagination = new PaginationDto();
    } else {
      pagination = (paginationOrUser as PaginationDto) || new PaginationDto();
      user = maybeUser!;
    }

    return this.findQueueTiers(queueId, pagination, user);
  }

  async getNotificationRules(
    queueId: number,
    tierId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const items = await this.serviceTiersRepository.findActiveNotificationRules(
      queueId,
      tierId,
    );

    return items.map((rule) => this.toNotificationRuleResponse(rule));
  }
}
