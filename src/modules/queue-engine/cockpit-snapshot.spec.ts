import { DataSource } from 'typeorm';
import { QueueEngineRepository } from './queue-engine.repository';

it('refreshes canonical statistics before opening the read-only cockpit snapshot', async () => {
  const order: string[] = [];
  const refresh = jest.fn(async () => {
    order.push('refresh');
    return [];
  });
  const query = jest
    .fn()
    .mockResolvedValueOnce([{ site_id: 'site' }])
    .mockResolvedValue([]);
  const transaction = jest.fn(
    async (
      isolation: string,
      work: (manager: { query: typeof query }) => Promise<unknown>,
    ) => {
      order.push(isolation);
      return work({ query });
    },
  );
  const repository = new QueueEngineRepository({
    query: refresh,
    transaction,
  } as unknown as DataSource);
  const now = new Date();
  await repository.getCockpitData({
    siteId: 'site',
    queueIds: ['queue'],
    userId: 'user',
    now,
    previewLimit: 3,
    recentLimit: 5,
  });
  expect(order).toEqual(['refresh', 'REPEATABLE READ']);
  expect(refresh).toHaveBeenCalledWith(
    expect.stringContaining('dorify.queue_wait_context'),
    [['queue'], now],
  );
  const contextRead = query.mock.calls.find((call) =>
    String(call[0]).includes('queue_wait_context'),
  );
  expect(contextRead?.[0]).toContain('NULL::date,FALSE');
});
