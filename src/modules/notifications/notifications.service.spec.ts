import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { NotificationsRepository } from './notifications.repository';

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
