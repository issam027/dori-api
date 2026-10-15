import { Injectable, Logger } from '@nestjs/common';
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
import { PaginatedResult } from '../../core/pagination/pagination.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ConfigService } from '@nestjs/config';
import {
  NotificationsRepository,
  ThresholdRuleRow,
} from './notifications.repository';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly notificationTemplateService: NotificationTemplateService,
  ) {}

  async findNotifications(
    filter: NotificationFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      [
        'notification_id',
        'channel',
        'notification_status',
        'sent_at',
        'created_at',
      ],
      'notification_id',
    );

    if (filter.queueId)
      await this.scopeService.checkQueueAccess(user, filter.queueId);
    if (filter.siteId)
      await this.scopeService.checkSiteAccess(user, filter.siteId);

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) return filter.createResponse([], 0);
    }
    const result = await this.notificationsRepository.findMany({
      filter,
      queueIds: scope.isGlobal ? undefined : scope.queueIds,
      sortField: safeSortField,
      sortOrder,
      pageSize,
      offset,
    });
    return filter.createResponse<NotificationResponseDto>(
      result.items as unknown as NotificationResponseDto[],
      result.total,
    );
  }

  async findNotificationById(notificationId: number, user: AuthenticatedUser) {
    const notification =
      await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new DoriException('NOTIFICATION_NOT_FOUND', { notificationId });
    }

    await this.scopeService.checkQueueAccess(user, notification.queue_id!);
    return notification;
  }

  async sendManualNotification(
    dto: SendManualNotificationDto,
    user: AuthenticatedUser,
  ) {
    const registration =
      await this.notificationsRepository.findActiveRegistration(
        dto.registrationId,
      );
    if (!registration) {
      throw new DoriException('REGISTRATION_NOT_FOUND', {
        registrationId: dto.registrationId,
      });
    }

    await this.scopeService.checkQueueAccess(user, registration.queue_id);

    const recipient =
      dto.recipient ||
      (dto.channel === 'sms' ? registration.phone_number : registration.email);

    if (!recipient) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            `Recipient ${dto.channel} address missing for this registration`,
          ],
        },
      );
    }

    const locale =
      registration.language_preference || registration.person_lang || 'fr';
    const now = this.clockService.now();

    return this.notificationsRepository.createManual(
      dto,
      locale,
      recipient,
      now,
    );
  }

  async resendNotification(notificationId: number, user: AuthenticatedUser) {
    await this.findNotificationById(notificationId, user);
    const now = this.clockService.now();

    return this.notificationsRepository.markPending(notificationId, now);
  }

  // HMAC Webhook (§5.10, §8.3)
  async handleWebhook(
    provider: string,
    signature: string,
    timestamp: string,
    eventId: string,
    rawBody: Buffer | string,
    dto: WebhookDeliveryDto,
  ) {
    // Secret per provider
    const normalizedProvider = provider.toLowerCase();
    const secret = this.configService.get<string>(
      `notifications.webhookSecrets.${normalizedProvider}`,
    );
    if (!secret) throw new DoriException('UNAUTHENTICATED');

    const timestampSeconds = Number(timestamp);
    const maxAgeSeconds = this.configService.getOrThrow<number>(
      'notifications.webhookMaxAgeSeconds',
    );
    const now = this.clockService.now();
    if (
      !Number.isInteger(timestampSeconds) ||
      Math.abs(now.getTime() / 1000 - timestampSeconds) > maxAgeSeconds
    ) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const receivedSig = signature.replace(/^sha256=/i, '');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    const receivedBuffer = Buffer.from(receivedSig, 'hex');
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      this.logger.warn(
        `Invalid HMAC signature for webhook from provider ${provider}`,
      );
      // Return 401 UNAUTHENTICATED
      throw new DoriException('UNAUTHENTICATED');
    }

    const outcome = await this.notificationsRepository.applyWebhook(
      normalizedProvider,
      eventId,
      dto,
      now,
    );
    if (outcome === 'missing') {
      throw new DoriException('NOTIFICATION_NOT_FOUND');
    }

    return { received: true };
  }

  // Threshold Evaluation (§4.1, §4.13)
  async evaluateQueueThresholds(queueId: number) {
    const now = this.clockService.now();

    // 1. Fetch active waiting clients for this queue
    const waitingClients =
      await this.notificationsRepository.findWaitingRegistrations(queueId);

    if (!waitingClients || waitingClients.length === 0) return;

    // Count active threads
    const activeThreads = Math.max(
      1,
      await this.notificationsRepository.countActiveThreads(queueId),
    );

    // 2. Fetch threshold rules for this queue
    const rules =
      await this.notificationsRepository.findThresholdRules(queueId);

    const rulesByTier = new Map<number, ThresholdRuleRow[]>();
    for (const r of rules) {
      if (!rulesByTier.has(r.tier_id)) rulesByTier.set(r.tier_id, []);
      rulesByTier.get(r.tier_id)!.push(r);
    }

    const matches: Array<{
      client: (typeof waitingClients)[number];
      rule: ThresholdRuleRow;
      locale: string;
    }> = [];
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

        if (thresholdPosSatisfied || thresholdMinSatisfied)
          matches.push({
            client,
            rule,
            locale:
              client.language_preference ||
              client.p_lang ||
              client.default_locale ||
              'fr',
          });
      }
    }
    if (!matches.length) return;

    const keys = matches.map(({ rule }) =>
      this.notificationTemplateService.templateKey(
        rule.channel,
        'threshold',
        rule.include_tracking_link,
      ),
    );
    const locales = [
      ...new Set([...matches.map(({ locale }) => locale), 'fr']),
    ];
    const templates = await this.notificationsRepository.findActiveTemplates(
      [...new Set(keys)],
      locales,
    );
    const templateMap = new Map(
      templates.map((template) => [
        `${template.translation_key}:${template.locale}`,
        template.content,
      ]),
    );
    const notifications = matches.map(({ client, rule, locale }) => {
      const key = this.notificationTemplateService.templateKey(
        rule.channel,
        'threshold',
        rule.include_tracking_link,
      );
      const template =
        templateMap.get(`${key}:${locale}`) ?? templateMap.get(`${key}:fr`);
      const recipient =
        rule.channel === 'sms' ? client.phone_number : client.email;
      const rendered = template
        ? this.notificationTemplateService.render(template, {
            firstName: client.first_name ?? '',
            ticket: client.ticket_number,
            trackingUrl: this.notificationTemplateService.buildTrackingUrl(
              client.registration_tracking_token,
            ),
          })
        : { content: null, failureReason: `TEMPLATE_NOT_FOUND:${key}` };
      const failureReason =
        (!recipient ? `RECIPIENT_MISSING:${rule.channel}` : null) ??
        rendered.failureReason;
      return {
        registrationId: client.registration_id,
        ruleId: rule.rule_id,
        channel: rule.channel,
        locale,
        recipient,
        content: rendered.content,
        status: failureReason ? ('failed' as const) : ('pending' as const),
        failureReason,
      };
    });
    await this.notificationsRepository.createThresholdNotifications(
      notifications,
      now,
    );
  }
}
