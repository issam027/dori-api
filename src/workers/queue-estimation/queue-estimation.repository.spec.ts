import { DataSource } from 'typeorm';
import { QueueStatisticsRepository } from '../../modules/queue-estimation/queue-statistics.repository';

describe('QueueStatisticsRepository', () => {
  it('calculates minute percentiles under an advisory lock', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const repository = new QueueStatisticsRepository(dataSource);

    await expect(
      repository.aggregateQueue({
        siteId: '00000000-0000-4000-8000-000000000002',
        queueId: '00000000-0000-4000-8000-000000000004',
        activityDate: '2026-10-20',
        now: new Date('2026-10-20T10:00:00Z'),
      }),
    ).resolves.toBe(true);

    expect(query.mock.calls[0][0]).toContain('hashtextextended');
    expect(query.mock.calls[0][1]).toEqual([
      'queue-estimation',
      '00000000-0000-4000-8000-000000000004',
    ]);
    const aggregation = query.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes('WITH ordered_calls'),
    );
    expect(aggregation).toBeDefined();
    expect(aggregation[0]).toContain('/ 60.0');
    expect(aggregation[0]).toContain('cycle_p50_minutes');
    expect(aggregation[1]).toEqual([
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000004',
      '2026-10-20',
      new Date('2026-10-20T10:00:00Z'),
    ]);
  });
});
