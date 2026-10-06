import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AssociateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  UpdateQueueTierDto,
  UpdateTierDto,
} from './dto/service-tier.dto';

export type ServiceTierRow = Record<string, unknown> & {
  tier_id: number;
  is_system: boolean;
};

export type QueueTierRow = Record<string, unknown> & {
  queue_id: number;
  tier_id: number;
  price: string | number;
  currency: string;
  is_active: boolean;
  display_order: number;
  tier_code: string;
  tier_name: string;
  tier_description?: string;
  description?: string;
  is_system: boolean;
};

export type NotificationRuleRow = Record<string, unknown> & {
  rule_id: number;
  queue_id: number;
  tier_id: number;
  notification_type: string;
  channel: string;
  threshold_position?: number | null;
  threshold_minutes?: number | null;
  include_tracking_link: boolean;
  is_active: boolean;
};

@Injectable()
export class ServiceTiersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findTierPage(input: {
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }) {
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dori_service_tier WHERE is_active = TRUE`,
    );
    const items: ServiceTierRow[] = await this.dataSource.query(
      `SELECT * FROM dori_service_tier WHERE is_active = TRUE
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $1 OFFSET $2`,
      [input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findActiveTier(tierId: number): Promise<ServiceTierRow | null> {
    const rows: ServiceTierRow[] = await this.dataSource.query(
      `SELECT * FROM dori_service_tier WHERE tier_id = $1 AND is_active = TRUE`,
      [tierId],
    );
    return rows[0] ?? null;
  }

  async createTier(input: {
    tierCode: string;
    tierName: string;
    description?: string;
    userId: number;
    now: Date;
  }) {
    const rows: ServiceTierRow[] = await this.dataSource.query(
      `INSERT INTO dori_service_tier
       (tier_code, tier_name, description, is_system, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, $4, $4, $5, $5) RETURNING *`,
      [
        input.tierCode,
        input.tierName,
        input.description ?? null,
        input.userId,
        input.now,
      ],
    );
    return rows[0];
  }

  async updateTier(
    tierId: number,
    dto: UpdateTierDto,
    userId: number,
    now: Date,
  ) {
    const entries: Array<[string, unknown]> = [
      ['tier_name', dto.tierName],
      ['description', dto.description],
      ['is_active', dto.isActive],
    ];
    return this.dynamicUpdate<ServiceTierRow>(
      'dori_service_tier',
      entries,
      userId,
      now,
      ['tier_id', tierId],
    );
  }

  async softDeleteTier(
    tierId: number,
    userId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dori_service_tier SET is_active = FALSE, deleted_at = $1,
       updated_by_user_id = $2, updated_at = $1 WHERE tier_id = $3`,
      [now, userId, tierId],
    );
  }

  async findQueueTier(
    queueId: number,
    tierId: number,
  ): Promise<QueueTierRow | null> {
    const rows: QueueTierRow[] = await this.dataSource.query(
      `SELECT qt.queue_id, qt.tier_id, qt.price, qt.currency, qt.is_active,
              qt.display_order, t.tier_code, t.tier_name, t.description, t.is_system
       FROM dori_queue_service_tier qt JOIN dori_service_tier t ON t.tier_id = qt.tier_id
       WHERE qt.queue_id = $1 AND qt.tier_id = $2`,
      [queueId, tierId],
    );
    return rows[0] ?? null;
  }

  async findQueueTierPage(input: {
    queueId: number;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }) {
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dori_queue_service_tier
       WHERE queue_id = $1 AND is_active = TRUE`,
      [input.queueId],
    );
    const items: QueueTierRow[] = await this.dataSource.query(
      `SELECT qt.*, t.tier_code, t.tier_name, t.description AS tier_description, t.is_system
       FROM dori_queue_service_tier qt JOIN dori_service_tier t ON t.tier_id = qt.tier_id
       WHERE qt.queue_id = $1 AND qt.is_active = TRUE
       ORDER BY qt.${input.sortField} ${input.sortOrder}, qt.tier_id ASC LIMIT $2 OFFSET $3`,
      [input.queueId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findQueueCurrency(queueId: number): Promise<string> {
    const rows: Array<{ default_currency: string }> =
      await this.dataSource.query(
        `SELECT s.default_currency FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id WHERE q.queue_id = $1`,
        [queueId],
      );
    return rows[0]?.default_currency ?? 'TND';
  }

  async upsertQueueTier(
    queueId: number,
    dto: AssociateQueueTierDto,
    currency: string,
    userId: number,
    now: Date,
  ) {
    await this.dataSource.query(
      `INSERT INTO dori_queue_service_tier
       (queue_id, tier_id, price, currency, display_order, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, $6, $7, $7)
       ON CONFLICT (queue_id, tier_id) DO UPDATE SET price = $3, currency = $4,
       display_order = COALESCE($5, dori_queue_service_tier.display_order), is_active = TRUE,
       deleted_at = NULL, updated_by_user_id = $6, updated_at = $7`,
      [
        queueId,
        dto.tierId,
        dto.price,
        currency,
        dto.displayOrder ?? null,
        userId,
        now,
      ],
    );
  }

  async updateQueueTier(
    queueId: number,
    tierId: number,
    dto: UpdateQueueTierDto,
    userId: number,
    now: Date,
  ) {
    const entries: Array<[string, unknown]> = [
      ['price', dto.price],
      ['currency', dto.currency],
      ['display_order', dto.displayOrder],
      ['is_active', dto.isActive],
    ];
    await this.dynamicUpdate<QueueTierRow>(
      'dori_queue_service_tier',
      entries,
      userId,
      now,
      ['queue_id', queueId],
      ['tier_id', tierId],
    );
  }

  async removeQueueTier(
    queueId: number,
    tierId: number,
    userId: number,
    now: Date,
  ) {
    await this.dataSource.query(
      `UPDATE dori_queue_service_tier SET is_active = FALSE, deleted_at = $1,
       updated_by_user_id = $2, updated_at = $1 WHERE queue_id = $3 AND tier_id = $4`,
      [now, userId, queueId, tierId],
    );
  }

  async findNotificationRulePage(input: {
    queueId: number;
    tierId: number;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }): Promise<{ items: NotificationRuleRow[]; total: number }> {
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE`,
      [input.queueId, input.tierId],
    );
    const items: NotificationRuleRow[] = await this.dataSource.query(
      `SELECT * FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $3 OFFSET $4`,
      [input.queueId, input.tierId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
  ): Promise<NotificationRuleRow | null> {
    const rows: NotificationRuleRow[] = await this.dataSource.query(
      `SELECT * FROM dori_tier_notification_rule
       WHERE rule_id = $1 AND queue_id = $2 AND tier_id = $3
         AND deleted_at IS NULL`,
      [ruleId, queueId, tierId],
    );
    return rows[0] ?? null;
  }

  async findActiveNotificationRules(
    queueId: number,
    tierId: number,
  ): Promise<NotificationRuleRow[]> {
    return this.dataSource.query(
      `SELECT * FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE
       ORDER BY rule_id ASC`,
      [queueId, tierId],
    );
  }

  async createNotificationRule(
    queueId: number,
    tierId: number,
    dto: CreateNotificationRuleDto,
    userId: number,
    now: Date,
  ): Promise<NotificationRuleRow> {
    const rows: NotificationRuleRow[] = await this.dataSource.query(
      `INSERT INTO dori_tier_notification_rule (
        queue_id, tier_id, notification_type, channel, threshold_position,
        threshold_minutes, include_tracking_link, created_by_user_id,
        updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), $8, $8, $9, $9)
      RETURNING *`,
      [
        queueId,
        tierId,
        dto.notificationType,
        dto.channel,
        dto.thresholdPosition ?? null,
        dto.thresholdMinutes ?? null,
        dto.includeTrackingLink ?? false,
        userId,
        now,
      ],
    );
    return rows[0];
  }

  async updateNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
    dto: UpdateNotificationRuleDto,
    userId: number,
    now: Date,
  ): Promise<NotificationRuleRow> {
    const entries: Array<[string, unknown]> = [
      ['notification_type', dto.notificationType],
      ['channel', dto.channel],
      ['threshold_position', dto.thresholdPosition],
      ['threshold_minutes', dto.thresholdMinutes],
      ['include_tracking_link', dto.includeTrackingLink],
      ['is_active', dto.isActive],
    ];
    return this.dynamicUpdate<NotificationRuleRow>(
      'dori_tier_notification_rule',
      entries,
      userId,
      now,
      ['rule_id', ruleId],
      ['queue_id', queueId],
      ['tier_id', tierId],
    );
  }

  async softDeleteNotificationRule(
    queueId: number,
    tierId: number,
    ruleId: number,
    userId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dori_tier_notification_rule
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE rule_id = $3 AND queue_id = $4 AND tier_id = $5`,
      [now, userId, ruleId, queueId, tierId],
    );
  }

  private async dynamicUpdate<T>(
    table: string,
    entries: Array<[string, unknown]>,
    userId: number,
    now: Date,
    ...keys: Array<[string, number]>
  ): Promise<T> {
    const values: unknown[] = [];
    const fields = entries
      .filter(([, value]) => value !== undefined)
      .map(([column, value]) => {
        values.push(value);
        return `${column} = $${values.length}`;
      });
    values.push(userId);
    fields.push(`updated_by_user_id = $${values.length}`);
    values.push(now);
    fields.push(`updated_at = $${values.length}`);
    const where = keys
      .map(([column, value]) => {
        values.push(value);
        return `${column} = $${values.length}`;
      })
      .join(' AND ');
    const rows: T[] = await this.dataSource.query(
      `UPDATE ${table} SET ${fields.join(', ')} WHERE ${where} RETURNING *`,
      values,
    );
    return rows[0];
  }
}
