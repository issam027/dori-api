import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AssociateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateQueueTierDto,
  UpdateTierDto,
} from './dto/service-tier.dto';

export type ServiceTierRow = Record<string, unknown> & {
  tier_id: string;
  tier_code: string;
  tier_name: string;
  description?: string | null;
  is_system: boolean;
  is_active: boolean;
};

export type QueueTierRow = Record<string, unknown> & {
  queue_id: string;
  tier_id: string;
  price: string | number;
  currency: string;
  currency_override?: string | null;
  currency_origin: 'association' | 'queue' | 'site';
  is_active: boolean;
  is_default: boolean;
  display_order: number;
  tier_code: string;
  tier_name: string;
  tier_description?: string;
  description?: string;
  is_system: boolean;
};

export type NotificationRuleRow = Record<string, unknown> & {
  rule_id: string;
  queue_id: string;
  tier_id: string;
  notification_type: 'welcome' | 'threshold';
  channel: string;
  threshold_position?: number | null;
  threshold_minutes?: number | null;
  include_tracking_link: boolean;
  is_active: boolean;
};

type NotificationRulePersistenceUpdate = {
  notificationType: 'welcome' | 'threshold';
  channel?: 'sms' | 'email';
  thresholdPosition: number | null;
  thresholdMinutes: number | null;
  includeTrackingLink?: boolean;
  isActive?: boolean;
};

const TIER_COLUMNS = `tier_id, tier_code, tier_name, description, is_system,
  is_active, deleted_at, created_by_user_id, updated_by_user_id, created_at, updated_at`;
const QUEUE_TIER_COLUMNS = `queue_id, tier_id, price, currency, is_active, is_default,
  display_order, deleted_at, created_by_user_id, updated_by_user_id, created_at, updated_at`;
const NOTIFICATION_RULE_COLUMNS = `rule_id, queue_id, tier_id, notification_type, channel,
  threshold_position, threshold_minutes, include_tracking_link, is_active, deleted_at,
  created_by_user_id, updated_by_user_id, created_at, updated_at`;

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
      `SELECT COUNT(*)::int AS total FROM dorify.dori_service_tier WHERE is_active = TRUE`,
    );
    const items: ServiceTierRow[] = await this.dataSource.query(
      `SELECT ${TIER_COLUMNS} FROM dorify.dori_service_tier WHERE is_active = TRUE
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $1 OFFSET $2`,
      [input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findActiveTier(tierId: string): Promise<ServiceTierRow | null> {
    const rows: ServiceTierRow[] = await this.dataSource.query(
      `SELECT ${TIER_COLUMNS} FROM dorify.dori_service_tier WHERE tier_id = $1 AND is_active = TRUE`,
      [tierId],
    );
    return rows[0] ?? null;
  }

  async createTier(input: {
    tierCode: string;
    tierName: string;
    description?: string;
    userId: string;
    now: Date;
  }) {
    const rows: ServiceTierRow[] = await this.dataSource.query(
      `INSERT INTO dorify.dori_service_tier
       (tier_code, tier_name, description, is_system, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, $4, $4, $5, $5) RETURNING ${TIER_COLUMNS}`,
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
    tierId: string,
    dto: UpdateTierDto,
    userId: string,
    now: Date,
  ) {
    const entries: Array<[string, unknown]> = [
      ['tier_name', dto.tierName],
      ['description', dto.description],
      ['is_active', dto.isActive],
    ];
    return this.dynamicUpdate<ServiceTierRow>(
      'dorify.dori_service_tier',
      entries,
      userId,
      now,
      [['tier_id', tierId]],
      TIER_COLUMNS,
    );
  }

  async softDeleteTier(
    tierId: string,
    userId: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dorify.dori_service_tier SET is_active = FALSE, deleted_at = $1,
       updated_by_user_id = $2, updated_at = $1 WHERE tier_id = $3`,
      [now, userId, tierId],
    );
  }

  async findQueueTier(
    queueId: string,
    tierId: string,
  ): Promise<QueueTierRow | null> {
    const rows: QueueTierRow[] = await this.dataSource.query(
      `SELECT qt.queue_id, qt.tier_id, qt.price, qt.currency AS currency_override,
              COALESCE(qt.currency, q.currency, s.default_currency) AS currency,
              CASE WHEN qt.currency IS NOT NULL THEN 'association'
                   WHEN q.currency IS NOT NULL THEN 'queue' ELSE 'site' END AS currency_origin,
              qt.is_active, qt.is_default, qt.display_order,
              t.tier_code, t.tier_name, t.description, t.is_system
       FROM dorify.dori_queue_service_tier qt
       JOIN dorify.dori_service_tier t ON t.tier_id = qt.tier_id
       JOIN dorify.dori_queue q ON q.queue_id = qt.queue_id
       JOIN dorify.dori_site s ON s.site_id = q.site_id
       WHERE qt.queue_id = $1 AND qt.tier_id = $2`,
      [queueId, tierId],
    );
    return rows[0] ?? null;
  }

  async findQueueTierPage(input: {
    queueId: string;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }) {
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dorify.dori_queue_service_tier
       WHERE queue_id = $1 AND is_active = TRUE`,
      [input.queueId],
    );
    const items: QueueTierRow[] = await this.dataSource.query(
      `SELECT qt.queue_id, qt.tier_id, qt.price, qt.is_active, qt.is_default,
              qt.display_order, qt.created_at, qt.updated_at,
              qt.currency AS currency_override,
              COALESCE(qt.currency, q.currency, s.default_currency) AS currency,
              CASE WHEN qt.currency IS NOT NULL THEN 'association'
                   WHEN q.currency IS NOT NULL THEN 'queue' ELSE 'site' END AS currency_origin,
              t.tier_code, t.tier_name, t.description AS tier_description, t.is_system
       FROM dorify.dori_queue_service_tier qt
       JOIN dorify.dori_service_tier t ON t.tier_id = qt.tier_id
       JOIN dorify.dori_queue q ON q.queue_id = qt.queue_id
       JOIN dorify.dori_site s ON s.site_id = q.site_id
       WHERE qt.queue_id = $1 AND qt.is_active = TRUE
       ORDER BY qt.${input.sortField} ${input.sortOrder}, qt.tier_id ASC LIMIT $2 OFFSET $3`,
      [input.queueId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async upsertQueueTier(
    queueId: string,
    dto: AssociateQueueTierDto,
    userId: string,
    now: Date,
  ) {
    await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await manager.query(
          `UPDATE dorify.dori_queue_service_tier SET is_default = FALSE,
           updated_by_user_id = $2, updated_at = $3
           WHERE queue_id = $1 AND is_default = TRUE`,
          [queueId, userId, now],
        );
      }
      await manager.query(
        `INSERT INTO dorify.dori_queue_service_tier
         (queue_id, tier_id, price, currency, display_order, is_default,
          created_by_user_id, updated_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, FALSE), $7, $7, $8, $8)
         ON CONFLICT (queue_id, tier_id) DO UPDATE SET price = $3, currency = $4,
         display_order = COALESCE($5, dorify.dori_queue_service_tier.display_order),
         is_default = COALESCE($6, dorify.dori_queue_service_tier.is_default), is_active = TRUE,
         deleted_at = NULL, updated_by_user_id = $7, updated_at = $8`,
        [
          queueId,
          dto.tierId,
          dto.price,
          dto.currency ?? null,
          dto.displayOrder ?? null,
          dto.isDefault ?? null,
          userId,
          now,
        ],
      );
    });
  }

  async updateQueueTier(
    queueId: string,
    tierId: string,
    dto: UpdateQueueTierDto,
    userId: string,
    now: Date,
  ) {
    await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await manager.query(
          `UPDATE dorify.dori_queue_service_tier SET is_default = FALSE,
           updated_by_user_id = $2, updated_at = $3
           WHERE queue_id = $1 AND is_default = TRUE`,
          [queueId, userId, now],
        );
      }
      const entries: Array<[string, unknown]> = [
        ['price', dto.price],
        ['currency', dto.currency],
        ['display_order', dto.displayOrder],
        ['is_active', dto.isActive],
        ['is_default', dto.isDefault],
      ];
      await this.dynamicUpdate<QueueTierRow>(
        'dorify.dori_queue_service_tier',
        entries,
        userId,
        now,
        [
          ['queue_id', queueId],
          ['tier_id', tierId],
        ],
        QUEUE_TIER_COLUMNS,
        manager,
      );
    });
  }

  async removeQueueTier(
    queueId: string,
    tierId: string,
    userId: string,
    now: Date,
  ) {
    await this.dataSource.query(
      `UPDATE dorify.dori_queue_service_tier SET is_active = FALSE, deleted_at = $1,
       updated_by_user_id = $2, updated_at = $1 WHERE queue_id = $3 AND tier_id = $4`,
      [now, userId, queueId, tierId],
    );
  }

  async findNotificationRulePage(input: {
    queueId: string;
    tierId: string;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }): Promise<{ items: NotificationRuleRow[]; total: number }> {
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dorify.dori_queue_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE`,
      [input.queueId, input.tierId],
    );
    const items: NotificationRuleRow[] = await this.dataSource.query(
      `SELECT ${NOTIFICATION_RULE_COLUMNS} FROM dorify.dori_queue_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $3 OFFSET $4`,
      [input.queueId, input.tierId, input.pageSize, input.offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findNotificationRule(
    queueId: string,
    tierId: string,
    ruleId: string,
  ): Promise<NotificationRuleRow | null> {
    const rows: NotificationRuleRow[] = await this.dataSource.query(
      `SELECT ${NOTIFICATION_RULE_COLUMNS} FROM dorify.dori_queue_tier_notification_rule
       WHERE rule_id = $1 AND queue_id = $2 AND tier_id = $3
         AND deleted_at IS NULL`,
      [ruleId, queueId, tierId],
    );
    return rows[0] ?? null;
  }

  async findActiveNotificationRules(
    queueId: string,
    tierId: string,
  ): Promise<NotificationRuleRow[]> {
    return this.dataSource.query(
      `SELECT ${NOTIFICATION_RULE_COLUMNS} FROM dorify.dori_queue_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE
       ORDER BY rule_id ASC`,
      [queueId, tierId],
    );
  }

  async createNotificationRule(
    queueId: string,
    tierId: string,
    dto: CreateNotificationRuleDto,
    userId: string,
    now: Date,
  ): Promise<NotificationRuleRow> {
    const thresholdPosition =
      dto.notificationType === 'threshold' && dto.thresholdType === 'position'
        ? (dto.thresholdValue ?? null)
        : null;
    const thresholdMinutes =
      dto.notificationType === 'threshold' &&
      dto.thresholdType === 'estimatedTime'
        ? (dto.thresholdValue ?? null)
        : null;
    const rows: NotificationRuleRow[] = await this.dataSource.query(
      `INSERT INTO dorify.dori_queue_tier_notification_rule (
        queue_id, tier_id, notification_type, channel, threshold_position,
        threshold_minutes, include_tracking_link, created_by_user_id,
        updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), $8, $8, $9, $9)
      RETURNING ${NOTIFICATION_RULE_COLUMNS}`,
      [
        queueId,
        tierId,
        dto.notificationType,
        dto.channel,
        thresholdPosition,
        thresholdMinutes,
        dto.includeTrackingLink ?? false,
        userId,
        now,
      ],
    );
    return rows[0];
  }

  async updateNotificationRule(
    queueId: string,
    tierId: string,
    ruleId: string,
    dto: NotificationRulePersistenceUpdate,
    userId: string,
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
      'dorify.dori_queue_tier_notification_rule',
      entries,
      userId,
      now,
      [
        ['rule_id', ruleId],
        ['queue_id', queueId],
        ['tier_id', tierId],
      ],
      NOTIFICATION_RULE_COLUMNS,
    );
  }

  async softDeleteNotificationRule(
    queueId: string,
    tierId: string,
    ruleId: string,
    userId: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dorify.dori_queue_tier_notification_rule
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE rule_id = $3 AND queue_id = $4 AND tier_id = $5`,
      [now, userId, ruleId, queueId, tierId],
    );
  }

  private async dynamicUpdate<T>(
    table: string,
    entries: Array<[string, unknown]>,
    userId: string,
    now: Date,
    keys: Array<[string, string]>,
    returningColumns: string,
    executor: DataSource | EntityManager = this.dataSource,
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
    const rows: T[] = await executor.query(
      `UPDATE ${table} SET ${fields.join(', ')} WHERE ${where} RETURNING ${returningColumns}`,
      values,
    );
    return rows[0];
  }
}
