import { DataSource, EntityManager } from 'typeorm';
import { ServiceTiersRepository } from './service-tiers.repository';

describe('ServiceTiersRepository queue-tier inheritance', () => {
  const now = new Date('2026-10-06T12:00:00Z');

  it('stores a nullable currency override and atomically replaces the queue default', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const dataSource = {
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => unknown) =>
          callback(manager as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    const repository = new ServiceTiersRepository(dataSource);

    await repository.upsertQueueTier(
      10,
      { tierId: 2, price: 15, currency: null, isDefault: true },
      7,
      now,
    );

    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(manager.query.mock.calls[0][0]).toContain('is_default = FALSE');
    expect(manager.query.mock.calls[1][0]).toContain('is_default');
    expect(manager.query.mock.calls[1][1]).toEqual([
      10,
      2,
      15,
      null,
      null,
      true,
      7,
      now,
    ]);
  });

  it('reads the effective currency through association, queue then site', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        queue_id: 10,
        tier_id: 2,
        price: '15',
        currency: 'EUR',
        currency_override: null,
        currency_origin: 'queue',
        is_active: true,
        is_default: false,
      },
    ]);
    const repository = new ServiceTiersRepository({
      query,
    } as unknown as DataSource);

    const result = await repository.findQueueTier(10, 2);

    expect(query.mock.calls[0][0]).toContain(
      'COALESCE(qt.currency, q.currency, s.default_currency)',
    );
    expect(result?.currency).toBe('EUR');
    expect(result?.currency_origin).toBe('queue');
  });
});
