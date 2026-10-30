import { QueueWaitEstimationService } from '../queue-estimation/queue-wait-estimation.service';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';

describe('Notification threshold consistency', () => {
  it('uses operational estimates rather than the input row order or a separate wait formula', async () => {
    const clients = [
      {
        registration_id: 'older-walkin',
        queue_id: 'queue',
        site_id: 'site',
        business_date: '2026-10-30',
        ticket_number: 'A1',
        tier_id: 'tier',
        registration_tracking_token: 'token-1',
        first_name: 'A',
        phone_number: '+2161',
        average_wait_time: 10,
      },
      {
        registration_id: 'priority-appointment',
        queue_id: 'queue',
        site_id: 'site',
        business_date: '2026-10-30',
        ticket_number: 'A2',
        tier_id: 'tier',
        registration_tracking_token: 'token-2',
        first_name: 'B',
        phone_number: '+2162',
        average_wait_time: 10,
      },
    ];
    const repository = {
      findWaitingRegistrations: jest.fn().mockResolvedValue(clients),
      findThresholdRules: jest.fn().mockResolvedValue([
        {
          rule_id: 'rule',
          tier_id: 'tier',
          channel: 'sms',
          threshold_position: 1,
          threshold_minutes: 0,
          include_tracking_link: false,
        },
      ]),
      findActiveTemplates: jest.fn().mockResolvedValue([
        {
          translation_key: 'sms.threshold',
          locale: 'fr',
          content: 'Ticket {ticket}',
        },
      ]),
      createThresholdNotifications: jest.fn().mockResolvedValue(1),
    };
    const estimates = {
      estimateMany: jest.fn().mockResolvedValue(
        new Map([
          ['older-walkin', { position: 2, estimatedWaitMinutes: 10 }],
          ['priority-appointment', { position: 1, estimatedWaitMinutes: 0 }],
        ]),
      ),
    };
    const now = new Date('2026-10-30T12:00:00Z');
    const service = new NotificationsService(
      repository as never,
      {} as ScopeService,
      { now: () => now } as ClockService,
      {} as ConfigService,
      new NotificationTemplateService({} as ConfigService),
      estimates as never,
    );
    await service.evaluateQueueThresholds('queue');
    expect(estimates.estimateMany).toHaveBeenCalledWith(clients, now);
    expect(repository.createThresholdNotifications).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          registrationId: 'priority-appointment',
          status: 'pending',
          content: 'Ticket A2',
        }),
      ],
      now,
    );
  });
});

describe('NotificationsService webhooks', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const timestamp = String(now.getTime() / 1000);
  const rawBody = Buffer.from(
    JSON.stringify({ messageId: 'msg-1', status: 'delivered' }),
  );
  const dto = { messageId: 'msg-1', status: 'delivered' as const };
  const secret = 'provider-secret';

  const createService = (
    outcome: 'updated' | 'duplicate' | 'missing' = 'updated',
  ) => {
    const repository = {
      applyWebhook: jest.fn().mockResolvedValue(outcome),
    } as unknown as NotificationsRepository;
    const config = {
      get: jest.fn((key: string) =>
        key === 'notifications.webhookSecrets.twilio' ? secret : undefined,
      ),
      getOrThrow: jest.fn().mockReturnValue(300),
    } as unknown as ConfigService;
    const clock = {
      now: jest.fn().mockReturnValue(now),
    } as unknown as ClockService;
    const service = new NotificationsService(
      repository,
      {} as ScopeService,
      clock,
      config,
      new NotificationTemplateService(config),
      {} as QueueWaitEstimationService,
    );
    return { service, repository };
  };

  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  it('rejects stale timestamps and unknown providers', async () => {
    const { service } = createService();
    await expect(
      service.handleWebhook('twilio', signature, '1', 'evt-1', rawBody, dto),
    ).rejects.toThrow();
    await expect(
      service.handleWebhook(
        'unknown',
        signature,
        timestamp,
        'evt-1',
        rawBody,
        dto,
      ),
    ).rejects.toThrow();
  });

  it('uses constant-time HMAC validation and binds the update to provider', async () => {
    const { service, repository } = createService();

    await expect(
      service.handleWebhook(
        'Twilio',
        signature,
        timestamp,
        'evt-1',
        rawBody,
        dto,
      ),
    ).resolves.toEqual({ received: true });
    expect(repository.applyWebhook).toHaveBeenCalledWith(
      'twilio',
      'evt-1',
      dto,
      now,
    );
  });

  it('acknowledges an already processed event without applying it twice', async () => {
    const { service, repository } = createService('duplicate');

    await service.handleWebhook(
      'twilio',
      signature,
      timestamp,
      'evt-1',
      rawBody,
      dto,
    );
    expect(repository.applyWebhook).toHaveBeenCalledTimes(1);
  });

  it('rejects an event for an unknown provider message', async () => {
    const { service } = createService('missing');
    await expect(
      service.handleWebhook(
        'twilio',
        signature,
        timestamp,
        'evt-1',
        rawBody,
        dto,
      ),
    ).rejects.toThrow();
  });
});
