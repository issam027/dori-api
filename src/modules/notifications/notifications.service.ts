import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import {
  SendManualNotificationDto,
  NotificationFilterDto,
  WebhookDeliveryDto,
} from './dto/notification.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findNotifications(
    filter: NotificationFilterDto,
    user: AuthenticatedUser,
  ) {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      ['notification_id', 'channel', 'notification_status', 'sent_at', 'created_at'],
      'notification_id',
    );

    let query = `
      SELECT n.*, c.ticket_number, c.business_date, p.first_name, p.last_name
      FROM dori_notification n
      JOIN dori_customer c ON c.customer_id = n.customer_id
      JOIN dori_person p ON p.person_id = c.person_id
      JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) return filter.createResponse([], 0);
      params.push(scope.queueIds);
      query += ` AND c.queue_id = ANY($${params.length})`;
    }

    if (filter.registrationId) {
      params.push(filter.registrationId);
      query += ` AND n.customer_id = $${params.length}`;
    }
    if (filter.channel) {
      params.push(filter.channel);
      query += ` AND n.channel = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      query += ` AND n.notification_status = $${params.length}`;
    }
    if (filter.businessDate) {
      params.push(filter.businessDate);
      query += ` AND c.business_date = $${params.length}`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) count_sub`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY n.${safeSortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async findNotificationById(notificationId: number, user: AuthenticatedUser) {
    const rows = await this.dataSource.query(
      `SELECT n.*, c.queue_id, c.ticket_number, c.business_date
       FROM dori_notification n
       JOIN dori_customer c ON c.customer_id = n.customer_id
       WHERE n.notification_id = $1`,
      [notificationId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('NOTIFICATION_NOT_FOUND', { notificationId });
    }

    const notif = rows[0];
    await this.scopeService.checkQueueAccess(user, notif.queue_id);
    return notif;
  }

  async sendManualNotification(
    dto: SendManualNotificationDto,
    user: AuthenticatedUser,
  ) {
    const customerRows = await this.dataSource.query(
      `SELECT c.*, p.phone_number, p.email, p.language_preference as person_lang
       FROM dori_customer c
       JOIN dori_person p ON p.person_id = c.person_id
       WHERE c.customer_id = $1 AND c.is_active = TRUE`,
      [dto.customerId],
    );

    if (!customerRows || customerRows.length === 0) {
      throw new DoriException('REGISTRATION_NOT_FOUND', {
        registrationId: dto.customerId,
      });
    }

    const customer = customerRows[0];
    await this.scopeService.checkQueueAccess(user, customer.queue_id);

    const recipient =
      dto.recipient ||
      (dto.channel === 'sms' ? customer.phone_number : customer.email);

    if (!recipient) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            `Recipient ${dto.channel} address missing for this customer`,
          ],
        },
      );
    }

    const locale = customer.language_preference || customer.person_lang || 'fr';
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `INSERT INTO dori_notification (
        customer_id, channel, notification_type, locale, recipient, notification_content,
        notification_status, attempt_count, created_at, updated_at
      ) VALUES ($1, $2, 'welcome', $3, $4, $5, 'pending', 0, $6, $6)
      RETURNING *`,
      [dto.customerId, dto.channel, locale, recipient, dto.content, now],
    );

    return res[0];
  }

  async resendNotification(notificationId: number, user: AuthenticatedUser) {
    await this.findNotificationById(notificationId, user);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `UPDATE dori_notification
       SET notification_status = 'pending', attempt_count = attempt_count + 1, failure_reason = NULL, updated_at = $1
       WHERE notification_id = $2
       RETURNING *`,
      [now, notificationId],
    );

    return res[0];
  }

  // HMAC Webhook (§5.10, §8.3)
  async handleWebhook(
    provider: string,
    signature: string,
    timestamp: string,
    rawBody: Buffer | string,
    dto: WebhookDeliveryDto,
  ) {
    // Secret per provider
    const secret =
      process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`] ||
      'webhook-secret';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (signature !== expectedSig) {
      this.logger.warn(
        `Invalid HMAC signature for webhook from provider ${provider}`,
      );
      // Return 401 UNAUTHENTICATED
      throw new DoriException('UNAUTHENTICATED');
    }

    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_notification
       SET notification_status = $1,
           delivered_at = CASE WHEN $1 = 'delivered' THEN $2 ELSE delivered_at END,
           failure_reason = CASE WHEN $1 = 'failed' THEN $3 ELSE failure_reason END,
           updated_at = $2
       WHERE provider_message_id = $4`,
      [dto.status, now, dto.reason || null, dto.messageId],
    );

    return { received: true };
  }

  // Threshold Evaluation (§4.1, §4.13)
  async evaluateQueueThresholds(queueId: number) {
    const now = this.clockService.now();

    // 1. Fetch active waiting clients for this queue
    const waitingClients = await this.dataSource.query(
      `SELECT c.customer_id, c.ticket_number, c.tier_id, c.language_preference,
              p.first_name, p.last_name, p.phone_number, p.email, p.language_preference as p_lang,
              q.average_wait_time, s.timezone, s.default_locale
       FROM dori_customer c
       JOIN dori_person p ON p.person_id = c.person_id
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE c.queue_id = $1 AND c.status = 'waiting' AND c.is_active = TRUE
       ORDER BY c.priority_reference_time ASC`,
      [queueId],
    );

    if (!waitingClients || waitingClients.length === 0) return;

    // Count active threads
    const activeThreadsRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM dori_queue_session
       WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
      [queueId],
    );
    const activeThreads = Math.max(1, activeThreadsRes[0]?.count || 1);

    // 2. Fetch threshold rules for this queue
    const rules = await this.dataSource.query(
      `SELECT * FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND notification_type = 'threshold' AND is_active = TRUE`,
      [queueId],
    );

    const rulesByTier = new Map<number, any[]>();
    for (const r of rules) {
      if (!rulesByTier.has(r.tier_id)) rulesByTier.set(r.tier_id, []);
      rulesByTier.get(r.tier_id)!.push(r);
    }

    for (let i = 0; i < waitingClients.length; i++) {
      const client = waitingClients[i];
      const position = i + 1;
      const estimatedMinutes = Math.round(
        (position * client.average_wait_time) / activeThreads,
      );

      const tierRules = rulesByTier.get(client.tier_id) || [];
      for (const rule of tierRules) {
        const thresholdPosSatisfied =
          rule.threshold_position != null &&
          position <= rule.threshold_position;
        const thresholdMinSatisfied =
          rule.threshold_minutes != null &&
          estimatedMinutes <= rule.threshold_minutes;

        if (thresholdPosSatisfied || thresholdMinSatisfied) {
          // Idempotency: check if already sent (§3.12, §4.1)
          const existing = await this.dataSource.query(
            `SELECT notification_id FROM dori_notification
             WHERE customer_id = $1 AND notification_type = 'threshold' AND channel = $2 AND notification_status <> 'failed'`,
            [client.customer_id, rule.channel],
          );

          if (!existing || existing.length === 0) {
            const recipient =
              rule.channel === 'sms' ? client.phone_number : client.email;
            if (recipient) {
              const locale =
                client.language_preference ||
                client.p_lang ||
                client.default_locale ||
                'fr';
              const content =
                `${client.first_name || ''}, votre tour approche. Ticket ${client.ticket_number}.`.trim();

              await this.dataSource.query(
                `INSERT INTO dori_notification (
                  customer_id, rule_id, channel, notification_type, locale, recipient,
                  notification_content, notification_status, attempt_count, created_at, updated_at
                ) VALUES ($1, $2, $3, 'threshold', $4, $5, $6, 'pending', 0, $7, $7)
                ON CONFLICT (customer_id, notification_type, channel) WHERE notification_status <> 'failed'
                DO NOTHING`,
                [
                  client.customer_id,
                  rule.rule_id,
                  rule.channel,
                  locale,
                  recipient,
                  content,
                  now,
                ],
              );
            }
          }
        }
      }
    }
  }
}
