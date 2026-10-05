import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';

describe('NotificationsService webhooks', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const timestamp = String(now.getTime() / 1000);
  const rawBody = Buffer.from(
    JSON.stringify({ messageId: 'msg-1', status: 'delivered' }),
  );
  const dto = { messageId: 'msg-1', status: 'delivered' as const };
  const secret = 'provider-secret';

  const createService = (managerResults: unknown[][] = []) => {
    const manager = {
      query: jest.fn().mockImplementation(() => managerResults.shift() ?? []),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;
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
      dataSource,
      {} as ScopeService,
      clock,
      config,
    );
    return { service, manager, dataSource };
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
    const { service, manager } = createService([
      [{ event_id: 'evt-1' }],
      [{ notification_id: 1 }],
    ]);

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
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'WHERE provider = $4 AND provider_message_id = $5',
      ),
      ['delivered', now, null, 'twilio', 'msg-1'],
    );
  });

  it('acknowledges an already processed event without applying it twice', async () => {
    const { service, manager } = createService([[]]);

    await service.handleWebhook(
      'twilio',
      signature,
      timestamp,
      'evt-1',
      rawBody,
      dto,
    );
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
