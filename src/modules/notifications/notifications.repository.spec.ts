import { DataSource } from 'typeorm';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  const dto = { messageId: 'msg-1', status: 'delivered' as const };

  const createRepository = (results: unknown[][]) => {
    const manager = {
      query: jest.fn().mockImplementation(() => results.shift() ?? []),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;
    return {
      repository: new NotificationsRepository(dataSource),
      manager,
    };
  };

  it('binds a webhook delivery to provider and provider message id', async () => {
    const { repository, manager } = createRepository([
      [{ event_id: 'evt-1' }],
      [{ notification_id: 1 }],
    ]);
    await expect(
      repository.applyWebhook('twilio', 'evt-1', dto, now),
    ).resolves.toBe('updated');
    expect(manager.query).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'WHERE provider = $4 AND provider_message_id = $5',
      ),
      ['delivered', now, null, 'twilio', 'msg-1'],
    );
  });

  it('does not apply a duplicate webhook event twice', async () => {
    const { repository, manager } = createRepository([[]]);
    await expect(
      repository.applyWebhook('twilio', 'evt-1', dto, now),
    ).resolves.toBe('duplicate');
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
