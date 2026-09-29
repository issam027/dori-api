import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateTierDto,
  UpdateTierDto,
  AssociateQueueTierDto,
  UpdateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './dto/service-tier.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class ServiceTiersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  // 1. Global catalog
  async findTiers(pagination: PaginationDto, _user?: AuthenticatedUser) {
    const { pageSize, offset, sortField, sortOrder } = pagination.getParams();
    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM dori_service_tier WHERE is_active = TRUE`,
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `SELECT * FROM dori_service_tier
       WHERE is_active = TRUE
       ORDER BY ${sortField === 'id' ? 'tier_id' : sortField} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`,
    );

    return pagination.createResponse(items, total);
  }

  async findTierById(tierId: number, _user?: AuthenticatedUser) {
    const res = await this.dataSource.query(
      `SELECT * FROM dori_service_tier WHERE tier_id = $1 AND is_active = TRUE`,
      [tierId],
    );
    if (!res || res.length === 0) {
      throw new DoriException('TIER_NOT_FOUND', { tierId });
    }
    return res[0];
  }

  async createTier(dto: CreateTierDto, user: AuthenticatedUser) {
    const now = this.clockService.now();
    const res = await this.dataSource.query(
      `INSERT INTO dori_service_tier (tier_code, tier_name, description, is_system, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, $4, $4, $5, $5)
       RETURNING *`,
      [dto.tierCode, dto.tierName, dto.description || null, user.userId, now],
    );
    return res[0];
  }

  async updateTier(
    tierId: number,
    dto: UpdateTierDto,
    user: AuthenticatedUser,
  ) {
    await this.findTierById(tierId);
    const now = this.clockService.now();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.tierName !== undefined) {
      fields.push(`tier_name = $${idx++}`);
      values.push(dto.tierName);
    }
    if (dto.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(tierId);

    const res = await this.dataSource.query(
      `UPDATE dori_service_tier SET ${fields.join(', ')} WHERE tier_id = $${idx} RETURNING *`,
      values,
    );
    return res[0];
  }

  async deleteTier(tierId: number, user: AuthenticatedUser) {
    const tier = await this.findTierById(tierId);
    if (tier.is_system) {
      throw new DoriException('TIER_IS_SYSTEM', { tierId });
    }

    const now = this.clockService.now();
    await this.dataSource.query(
      `UPDATE dori_service_tier
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE tier_id = $3`,
      [now, user.userId, tierId],
    );

    return { tierId, deleted: true };
  }

  async findQueueTiers(
    queueId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const { pageSize, offset } = pagination.getParams();

    const query = `
      SELECT qt.*, t.tier_code, t.tier_name, t.description as tier_description, t.is_system
      FROM dori_queue_service_tier qt
      JOIN dori_service_tier t ON t.tier_id = qt.tier_id
      WHERE qt.queue_id = $1 AND qt.is_active = TRUE
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      [queueId],
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `${query} ORDER BY qt.display_order ASC, qt.tier_id ASC LIMIT ${pageSize} OFFSET ${offset}`,
      [queueId],
    );

    return pagination.createResponse(items, total);
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
      const siteRes = await this.dataSource.query(
        `SELECT s.default_currency
         FROM dori_site_queue_thread q
         JOIN dori_site s ON s.site_id = q.site_id
         WHERE q.queue_id = $1`,
        [queueId],
      );
      currency = siteRes[0]?.default_currency || 'TND';
    }

    const res = await this.dataSource.query(
      `INSERT INTO dori_queue_service_tier (queue_id, tier_id, price, currency, display_order, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, $6, $7, $7)
       ON CONFLICT (queue_id, tier_id)
       DO UPDATE SET price = $3, currency = $4, display_order = COALESCE($5, dori_queue_service_tier.display_order),
                     is_active = TRUE, deleted_at = NULL, updated_by_user_id = $6, updated_at = $7
       RETURNING *`,
      [
        queueId,
        dto.tierId,
        dto.price,
        currency,
        dto.displayOrder ?? null,
        user.userId,
        now,
      ],
    );

    return res[0];
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

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.price !== undefined) {
      fields.push(`price = $${idx++}`);
      values.push(dto.price);
    }
    if (dto.currency !== undefined) {
      fields.push(`currency = $${idx++}`);
      values.push(dto.currency);
    }
    if (dto.displayOrder !== undefined) {
      fields.push(`display_order = $${idx++}`);
      values.push(dto.displayOrder);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(queueId);
    values.push(tierId);

    const res = await this.dataSource.query(
      `UPDATE dori_queue_service_tier SET ${fields.join(', ')} WHERE queue_id = $${idx++} AND tier_id = $${idx} RETURNING *`,
      values,
    );

    return res[0];
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
    await this.dataSource.query(
      `UPDATE dori_queue_service_tier
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE queue_id = $3 AND tier_id = $4`,
      [now, user.userId, queueId, tierId],
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
    const { pageSize, offset, sortField, sortOrder } = pagination.getParams();

    const query = `
      SELECT * FROM dori_tier_notification_rule
      WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      [queueId, tierId],
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `${query} ORDER BY ${sortField === 'id' ? 'rule_id' : sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      [queueId, tierId],
    );

    return pagination.createResponse(items, total);
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

    const res = await this.dataSource.query(
      `INSERT INTO dori_tier_notification_rule (
        queue_id, tier_id, notification_type, channel, threshold_position, threshold_minutes,
        include_tracking_link, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), $8, $8, $9, $9
      ) RETURNING *`,
      [
        queueId,
        tierId,
        dto.notificationType,
        dto.channel,
        dto.thresholdPosition ?? null,
        dto.thresholdMinutes ?? null,
        dto.includeTrackingLink ?? false,
        user.userId,
        now,
      ],
    );

    return res[0];
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

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.notificationType !== undefined) {
      fields.push(`notification_type = $${idx++}`);
      values.push(dto.notificationType);
    }
    if (dto.channel !== undefined) {
      fields.push(`channel = $${idx++}`);
      values.push(dto.channel);
    }
    if (dto.thresholdPosition !== undefined) {
      fields.push(`threshold_position = $${idx++}`);
      values.push(dto.thresholdPosition);
    }
    if (dto.thresholdMinutes !== undefined) {
      fields.push(`threshold_minutes = $${idx++}`);
      values.push(dto.thresholdMinutes);
    }
    if (dto.includeTrackingLink !== undefined) {
      fields.push(`include_tracking_link = $${idx++}`);
      values.push(dto.includeTrackingLink);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(ruleId);
    values.push(queueId);
    values.push(tierId);

    const res = await this.dataSource.query(
      `UPDATE dori_tier_notification_rule SET ${fields.join(', ')}
       WHERE rule_id = $${idx++} AND queue_id = $${idx++} AND tier_id = $${idx}
       RETURNING *`,
      values,
    );

    return res[0];
  }

  async deleteNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_tier_notification_rule
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE rule_id = $3 AND queue_id = $4 AND tier_id = $5`,
      [now, user.userId, ruleId, queueId, tierId],
    );

    return { ruleId, deleted: true };
  }

  async getQueueTiers(queueId: number, user: AuthenticatedUser) {
    const res = await this.findQueueTiers(queueId, new PaginationDto(), user);
    return res.items.map((qt: any) => ({
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
  }

  async getNotificationRules(
    queueId: number,
    tierId: number,
    user: AuthenticatedUser,
  ) {
    const res = await this.findNotificationRules(
      queueId,
      tierId,
      new PaginationDto(),
      user,
    );
    return res.items.map((r: any) => ({
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
