import { DataSource } from 'typeorm';
import { QueueStatisticsRepository } from '../../modules/queue-estimation/queue-statistics.repository';

describe('QueueStatisticsRepository', () => {
  it('delegates aggregation and locking to the shared database engine', async () => {
    const query = jest.fn().mockResolvedValue([{ refreshed: true }]);
    const repository = new QueueStatisticsRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-20T10:00:00Z');
    await expect(
      repository.aggregateQueue({
        siteId: '00000000-0000-4000-8000-000000000002',
        queueId: '00000000-0000-4000-8000-000000000004',
        activityDate: '2026-10-20',
        now,
      }),
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('dorify.queue_refresh_estimation_stats'),
      [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000004',
        '2026-10-20',
        now,
      ],
    );
  });
});
