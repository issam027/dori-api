import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  NotificationFilterDto,
  SendManualNotificationDto,
  WebhookDeliveryDto,
} from './dto/notification.dto';

export type NotificationRow = Record<string, unknown> & {
  notification_id: number;
  queue_id?: number;
};

export interface NotificationListQuery {
  filter: NotificationFilterDto;
  queueIds?: number[];
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

export interface NotificationCustomerRow extends Record<string, unknown> {
  customer_id: number;
  queue_id: number;
  phone_number?: string;
  email?: string;
  language_preference?: string;
  person_lang?: string;
}

export interface WaitingCustomerRow extends NotificationCustomerRow {
  ticket_number: string;
  tier_id: number;
  first_name?: string;
  p_lang?: string;
  average_wait_time: number;
  default_locale?: string;
}

export interface ThresholdRuleRow extends Record<string, unknown> {
  rule_id: number;
  tier_id: number;
  channel: 'sms' | 'email';
  threshold_position?: number;
  threshold_minutes?: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findMany(
    query: NotificationListQuery,
  ): Promise<{ items: NotificationRow[]; total: number }> {
    const params: unknown[] = [];
    let where = '1=1';
    if (query.queueIds) {
      params.push(query.queueIds);
      where += ` AND c.queue_id = ANY($${params.length})`;
    }
    const filters: Array<[unknown, string]> = [
      [query.filter.registrationId, 'n.customer_id'],
      [query.filter.channel, 'n.channel'],
      [query.filter.status, 'n.notification_status'],
      [query.filter.businessDate, 'c.business_date'],
    ];
    for (const [value, column] of filters) {
      if (value !== undefined) {
        params.push(value);
        where += ` AND ${column} = $${params.length}`;
      }
    }
    const from = `FROM dori_notification n
      JOIN dori_customer c ON c.customer_id = n.customer_id
      JOIN dori_person p ON p.person_id = c.person_id
      JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
      WHERE ${where}`;
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const items: NotificationRow[] = await this.dataSource.query(
      `SELECT n.*, c.ticket_number, c.business_date, p.first_name, p.last_name ${from}
       ORDER BY n.${query.sortField} ${query.sortOrder}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async findById(notificationId: number): Promise<NotificationRow | null> {
    const rows: NotificationRow[] = await this.dataSource.query(
      `SELECT n.*, c.queue_id, c.ticket_number, c.business_date
       FROM dori_notification n
       JOIN dori_customer c ON c.customer_id = n.customer_id
       WHERE n.notification_id = $1`,
      [notificationId],
    );
    return rows[0] ?? null;
  }

  async findActiveCustomer(
    customerId: number,
  ): Promise<NotificationCustomerRow | null> {
    const rows: NotificationCustomerRow[] = await this.dataSource.query(
      `SELECT c.*, p.phone_number, p.email, p.language_preference AS person_lang
       FROM dori_customer c JOIN dori_person p ON p.person_id = c.person_id
       WHERE c.customer_id = $1 AND c.is_active = TRUE`,
      [customerId],
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
      `INSERT INTO dori_notification (
        customer_id, channel, notification_type, locale, recipient, notification_content,
        notification_status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, 'welcome', $3, $4, $5, 'pending', 0, $6, $6) RETURNING *`,
      [dto.customerId, dto.channel, locale, recipient, dto.content, now],
    );
    return rows[0];
  }

  async markPending(
    notificationId: number,
    now: Date,
  ): Promise<NotificationRow> {
    const rows: NotificationRow[] = await this.dataSource.query(
      `UPDATE dori_notification
       SET notification_status = 'pending', attempt_count = attempt_count + 1,
           failure_reason = NULL, updated_at = $1
       WHERE notification_id = $2 RETURNING *`,
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
        `INSERT INTO dori_webhook_event (provider, event_id, received_at)
         VALUES ($1, $2, $3) ON CONFLICT (provider, event_id) DO NOTHING RETURNING event_id`,
        [provider, eventId, now],
      );
      if (accepted.length === 0) return 'duplicate';
      const updated: Array<{ notification_id: number }> = await manager.query(
        `UPDATE dori_notification
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

  async findWaitingCustomers(queueId: number): Promise<WaitingCustomerRow[]> {
    return this.dataSource.query(
      `SELECT c.customer_id, c.ticket_number, c.tier_id, c.language_preference,
              p.first_name, p.last_name, p.phone_number, p.email, p.language_preference AS p_lang,
              q.average_wait_time, s.timezone, s.default_locale
       FROM dori_customer c
       JOIN dori_person p ON p.person_id = c.person_id
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE c.queue_id = $1 AND c.status = 'waiting' AND c.is_active = TRUE
       ORDER BY c.priority_reference_time ASC`,
      [queueId],
    );
  }

  async countActiveThreads(queueId: number): Promise<number> {
    const rows: Array<{ count: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM dori_queue_session
       WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId],
    );
    return rows[0]?.count ?? 0;
  }

  async findThresholdRules(queueId: number): Promise<ThresholdRuleRow[]> {
    return this.dataSource.query(
      `SELECT * FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND notification_type = 'threshold' AND is_active = TRUE`,
      [queueId],
    );
  }

  async createThresholdIfAbsent(input: {
    customerId: number;
    ruleId: number;
    channel: string;
    locale: string;
    recipient: string;
    content: string;
    now: Date;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO dori_notification (
        customer_id, rule_id, channel, notification_type, locale, recipient,
        notification_content, notification_status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, $3, 'threshold', $4, $5, $6, 'pending', 0, $7, $7)
      ON CONFLICT (customer_id, notification_type, channel)
      WHERE notification_status <> 'failed' DO NOTHING`,
      [
        input.customerId,
        input.ruleId,
        input.channel,
        input.locale,
        input.recipient,
        input.content,
        input.now,
      ],
    );
  }
}
