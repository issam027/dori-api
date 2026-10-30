import {
  PreparedNotification,
  insertPreparedNotifications,
} from '../../core/notifications/notification-batch';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  NotificationFilterDto,
  SendManualNotificationDto,
  WebhookDeliveryDto,
} from './dto/notification.dto';

export type NotificationRow = Record<string, unknown> & {
  notification_id: string;
  registration_id: string;
  queue_id?: string;
  channel: string;
  notification_type: 'welcome' | 'threshold';
  locale: string;
  recipient?: string | null;
  notification_content: string;
  notification_status: string;
  attempt_count: number;
  delivered_at?: Date | string | null;
  failure_reason?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  ticket_number?: string;
  business_date?: string;
  first_name?: string;
  last_name?: string;
};

export interface NotificationListQuery {
  filter: NotificationFilterDto;
  queueIds?: string[];
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

export interface NotificationRegistrationRow extends Record<string, unknown> {
  registration_id: string;
  queue_id: string;
  phone_number?: string;
  email?: string;
  language_preference?: string;
  person_lang?: string;
}

export interface WaitingRegistrationRow extends NotificationRegistrationRow {
  site_id: string;
  business_date: string;
  ticket_number: string;
  tier_id: string;
  first_name?: string;
  p_lang?: string;
  average_wait_time: number;
  default_locale?: string;
  registration_tracking_token: string;
}

export interface ThresholdRuleRow extends Record<string, unknown> {
  rule_id: string;
  tier_id: string;
  channel: 'sms' | 'email';
  threshold_position?: number;
  threshold_minutes?: number;
  include_tracking_link: boolean;
}

const NOTIFICATION_COLUMNS = `notification_id, registration_id, rule_id, channel,
  notification_type, locale, recipient, notification_content, notification_status,
  processing_started_at, provider, provider_message_id, failure_reason, attempt_count,
  sent_at, delivered_at, created_at, updated_at`;
const notificationColumns = (alias: string) =>
  NOTIFICATION_COLUMNS.split(',')
    .map((column) => `${alias}.${column.trim()}`)
    .join(', ');

@Injectable()
export class NotificationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findMany(
    query: NotificationListQuery,
  ): Promise<{ items: NotificationRow[]; total: number }> {
    const params: unknown[] = [];
    const conditions: string[] = [];
    const addCondition = (condition: string, value: unknown) => {
      params.push(value);
      conditions.push(condition.replace('?', `$${params.length}`));
    };
    if (query.queueIds) {
      addCondition('c.queue_id = ANY(?)', query.queueIds);
    }
    if (query.filter.queueId !== undefined) {
      addCondition('c.queue_id = ?', query.filter.queueId);
    }
    if (query.filter.siteId !== undefined) {
      addCondition('q.site_id = ?', query.filter.siteId);
    }
    const filters: Array<[unknown, string]> = [
      [query.filter.registrationId, 'n.registration_id'],
      [query.filter.channel, 'n.channel'],
      [query.filter.status, 'n.notification_status'],
    ];
    for (const [value, column] of filters) {
      if (value !== undefined) addCondition(`${column} = ?`, value);
    }
    if (query.filter.dateFrom !== undefined) {
      addCondition('c.business_date >= ?', query.filter.dateFrom);
    }
    if (query.filter.dateTo !== undefined) {
      addCondition('c.business_date <= ?', query.filter.dateTo);
    }
    const where = conditions.length ? conditions.join(' AND ') : 'TRUE';
    const from = `FROM dorify.dori_notification n
      JOIN dorify.dori_registration c ON c.registration_id = n.registration_id
      JOIN dorify.dori_person p ON p.person_id = c.person_id
      JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
      WHERE ${where}`;
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const items: NotificationRow[] = await this.dataSource.query(
      `SELECT ${notificationColumns('n')}, c.ticket_number, c.business_date, p.first_name, p.last_name ${from}
       ORDER BY n.${query.sortField} ${query.sortOrder}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async findById(notificationId: string): Promise<NotificationRow | null> {
    const rows: NotificationRow[] = await this.dataSource.query(
      `SELECT ${notificationColumns('n')}, c.queue_id, c.ticket_number, c.business_date
       FROM dorify.dori_notification n
       JOIN dorify.dori_registration c ON c.registration_id = n.registration_id
       WHERE n.notification_id = $1`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async findActiveRegistration(
    registrationId: string,
  ): Promise<NotificationRegistrationRow | null> {
    const rows: NotificationRegistrationRow[] = await this.dataSource.query(
      `SELECT c.registration_id, c.queue_id, c.language_preference,
              p.phone_number, p.email, p.language_preference AS person_lang
       FROM dorify.dori_registration c JOIN dorify.dori_person p ON p.person_id = c.person_id
       WHERE c.registration_id = $1 AND c.is_active = TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async createManual(
    dto: SendManualNotificationDto,
    locale: string,
    recipient: string,
    now: Date,
  ): Promise<NotificationRow> {
    const rows: NotificationRow[] = await this.dataSource.query(
      `INSERT INTO dorify.dori_notification (
        registration_id, channel, notification_type, locale, recipient, notification_content,
        notification_status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, 'welcome', $3, $4, $5, 'pending', 0, $6, $6)
        RETURNING ${NOTIFICATION_COLUMNS}`,
      [dto.registrationId, dto.channel, locale, recipient, dto.content, now],
    );
    return rows[0];
  }

  async markPending(
    notificationId: string,
    now: Date,
  ): Promise<NotificationRow> {
    const rows: NotificationRow[] = await this.dataSource.query(
      `UPDATE dorify.dori_notification
       SET notification_status = 'pending', attempt_count = attempt_count + 1,
           failure_reason = NULL, updated_at = $1
       WHERE notification_id = $2 RETURNING ${NOTIFICATION_COLUMNS}`,
      [now, notificationId],
    );
    return rows[0];
  }

  async applyWebhook(
    provider: string,
    eventId: string,
    dto: WebhookDeliveryDto,
    now: Date,
  ): Promise<'updated' | 'duplicate' | 'missing'> {
    return this.dataSource.transaction(async (manager) => {
      const accepted: Array<{ event_id: string }> = await manager.query(
        `INSERT INTO dorify.dori_webhook_event (provider, event_id, received_at)
         VALUES ($1, $2, $3) ON CONFLICT (provider, event_id) DO NOTHING RETURNING event_id`,
        [provider, eventId, now],
      );
      if (accepted.length === 0) return 'duplicate';
      const updated: Array<{ notification_id: string }> = await manager.query(
        `UPDATE dorify.dori_notification
         SET notification_status = $1,
             delivered_at = CASE WHEN $1 = 'delivered' THEN $2 ELSE delivered_at END,
             failure_reason = CASE WHEN $1 = 'failed' THEN $3 ELSE failure_reason END,
             updated_at = $2
         WHERE provider = $4 AND provider_message_id = $5 RETURNING notification_id`,
        [dto.status, now, dto.reason ?? null, provider, dto.messageId],
      );
      return updated.length > 0 ? 'updated' : 'missing';
    });
  }

  async findWaitingRegistrations(
    queueId: string,
  ): Promise<WaitingRegistrationRow[]> {
    return this.dataSource.query(
      `SELECT c.registration_id, c.queue_id, q.site_id, c.business_date::text AS business_date,
              c.ticket_number, c.tier_id, c.language_preference,
              c.registration_tracking_token,
              p.first_name, p.last_name, p.phone_number, p.email, p.language_preference AS p_lang,
              q.average_wait_time, s.timezone, s.default_locale
       FROM dorify.dori_registration c
       JOIN dorify.dori_person p ON p.person_id = c.person_id
       JOIN dorify.dori_queue q ON q.queue_id = c.queue_id
       JOIN dorify.dori_site s ON s.site_id = q.site_id
       WHERE c.queue_id = $1 AND c.status = 'waiting' AND c.is_active = TRUE
       ORDER BY c.priority_reference_time ASC`,
      [queueId],
    );
  }

  async findThresholdRules(queueId: string): Promise<ThresholdRuleRow[]> {
    return this.dataSource.query(
      `SELECT rule_id, tier_id, channel, threshold_position, threshold_minutes,
              include_tracking_link FROM dorify.dori_queue_tier_notification_rule
       WHERE queue_id = $1 AND notification_type = 'threshold' AND is_active = TRUE`,
      [queueId],
    );
  }

  async findActiveTemplates(
    keys: string[],
    locales: string[],
  ): Promise<
    Array<{ translation_key: string; locale: string; content: string }>
  > {
    if (!keys.length) return [];
    return this.dataSource.query(
      `SELECT translation_key, locale, content FROM dorify.dori_translation
       WHERE translation_key = ANY($1) AND locale = ANY($2) AND is_active = TRUE`,
      [keys, locales],
    );
  }

  createThresholdNotifications(
    notifications: PreparedNotification[],
    now: Date,
  ): Promise<number> {
    return insertPreparedNotifications(
      this.dataSource,
      'threshold',
      notifications,
      now,
    );
  }
}
