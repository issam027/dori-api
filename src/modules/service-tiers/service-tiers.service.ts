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
  QueueTierDetailDto,
  ServiceTierDetailDto,
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
    notificationType: string;
    thresholdPosition?: number | null;
    thresholdMinutes?: number | null;
    includeTrackingLink?: boolean;
  }) {
    if (
      rule.notificationType === 'threshold' &&
      rule.thresholdPosition == null &&
      rule.thresholdMinutes == null
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: ['Threshold rule requires position or minutes'],
        },
      );
    }
    if (
      rule.includeTrackingLink &&
      !['welcome', 'trakingLink'].includes(rule.notificationType)
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            'Tracking link allowed only on welcome or trakingLink rules',
          ],
        },
      );
    }
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
      isEnabled: row.is_active,
      isDefault: row.is_system || false,
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
  ): Promise<PaginatedResult<ServiceTierDetailDto>> {
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
    return pagination.createResponse<ServiceTierDetailDto>(
      result.items as unknown as ServiceTierDetailDto[],
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
  ): Promise<PaginatedResult<QueueTierDetailDto>> {
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
      isEnabled: qt.is_active,
      isDefault: qt.is_system || false,
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

    return pagination.createResponse<QueueTierDetailDto>(
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

    // Default currency from site if not provided
    let currency = dto.currency;
    if (!currency) {
      currency = await this.serviceTiersRepository.findQueueCurrency(queueId);
    }

    await this.serviceTiersRepository.upsertQueueTier(
      queueId,
      dto,
      currency,
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
    return pagination.createResponse(result.items, result.total);
  }

  async createNotificationRule(
    queueId: number,
    tierId: number,
    dto: CreateNotificationRuleDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    // Check threshold criteria invariant (§3.8)
    if (
      dto.notificationType === 'threshold' &&
      dto.thresholdPosition == null &&
      dto.thresholdMinutes == null
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['Threshold rule requires position or minutes'] },
      );
    }

    // Check tracking link invariant (§3.8): tracking link can only be on welcome or trakingLink
    if (
      dto.includeTrackingLink &&
      !['welcome', 'trakingLink'].includes(dto.notificationType)
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            'Tracking link allowed only on welcome or trakingLink rules',
          ],
        },
      );
    }

    return this.serviceTiersRepository.createNotificationRule(
      queueId,
      tierId,
      dto,
      user.userId,
      now,
    );
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
    this.validateNotificationRule({
      notificationType: dto.notificationType ?? current.notification_type,
      thresholdPosition: dto.thresholdPosition ?? current.threshold_position,
      thresholdMinutes: dto.thresholdMinutes ?? current.threshold_minutes,
      includeTrackingLink:
        dto.includeTrackingLink ?? current.include_tracking_link,
    });

    return this.serviceTiersRepository.updateNotificationRule(
      queueId,
      tierId,
      ruleId,
      dto,
      user.userId,
      now,
    );
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
  ): Promise<PaginatedResult<QueueTierDetailDto>> {
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

    return items.map((r) => ({
      ruleId: r.rule_id,
      queueId: r.queue_id,
      tierId: r.tier_id,
      triggerEvent: r.notification_type,
      thresholdType:
        r.threshold_position != null
          ? 'position'
          : r.threshold_minutes != null
            ? 'estimated_time'
            : 'position',
      thresholdValue: r.threshold_position ?? r.threshold_minutes ?? 0,
      channel: r.channel,
      templateKey: undefined,
      isActive: r.is_active,
      notificationType: r.notification_type,
      thresholdPosition: r.threshold_position,
      thresholdMinutes: r.threshold_minutes,
      includeTrackingLink: r.include_tracking_link,
    }));
  }
}
