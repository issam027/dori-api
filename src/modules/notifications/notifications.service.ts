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
import { NotificationDetailDto } from './dto/notification-response.dto';
import { ConfigService } from '@nestjs/config';
import {
  NotificationsRepository,
  ThresholdRuleRow,
} from './notifications.repository';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
  ) {}

  async findNotifications(
    filter: NotificationFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<NotificationDetailDto>> {
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
    return filter.createResponse<NotificationDetailDto>(
      result.items as unknown as NotificationDetailDto[],
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
            await this.notificationsRepository.createThresholdIfAbsent({
              registrationId: client.registration_id,
              ruleId: rule.rule_id,
              channel: rule.channel,
              locale,
              recipient,
              content,
              now,
            });
          }
        }
      }
    }
  }
}
