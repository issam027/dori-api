import { DataSource } from 'typeorm';
import { QueuesRepository } from './queues.repository';

describe('QueuesRepository', () => {
  it('loads an active queue together with inherited site configuration', async () => {
    const row = { queue_id: 5, queue_code: 'A', site_id: 2 };
    const dataSource = {
      query: jest.fn().mockResolvedValue([row]),
    } as unknown as DataSource;

    const result = await new QueuesRepository(dataSource).findActiveById(5);

    expect(result).toBe(row);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('s.default_daily_reset_time'),
      [5],
    );
  });

  it('binds scope, search, limit and offset for paginated lists', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([{ queue_id: 5 }]),
    } as unknown as DataSource;

    const result = await new QueuesRepository(dataSource).findPage({
      siteIds: [2, 3],
      search: 'accueil',
      sortField: 'q.created_at',
      sortOrder: 'DESC',
      pageSize: 20,
      offset: 40,
    });

    expect(result.total).toBe(1);
    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $3 OFFSET $4'),
      [[2, 3], '%accueil%', 20, 40],
    );
  });

  it('creates a queue and its free tier atomically with typed time parameters', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ site_id: 2 }])
      .mockResolvedValueOnce([{ queue_id: 8 }])
      .mockResolvedValueOnce([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    const queueId = await new QueuesRepository(
      dataSource,
    ).createWithDefaultTier(
      2,
      {
        queueCode: 'ACC',
        workingHoursStart: '08:00',
        workingHoursEnd: '17:00',
        dailyResetTime: '03:00',
      },
      1,
      new Date('2026-10-06T12:00:00Z'),
    );

    expect(queueId).toBe(8);
    expect(query.mock.calls[1][0]).toContain('$10::time');
    expect(query.mock.calls[1][0]).toContain('$21::time');
    expect(query.mock.calls[2][0]).toContain("tier_code = 'free'");
  });

  it('casts time fields during updates and deactivates dependencies atomically', async () => {
    const query = jest.fn().mockResolvedValue([{ queue_id: 8 }]);
    const dataSource = {
      query,
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const repository = new QueuesRepository(dataSource);
    const now = new Date('2026-10-06T12:00:00Z');

    expect(
      await repository.update(
        8,
        { workingHoursStart: '09:00', dailyResetTime: '02:00' },
        1,
        now,
      ),
    ).toBe(true);
    expect(query.mock.calls[0][0]).toContain('working_hours_start = $1::time');
    expect(query.mock.calls[0][0]).toContain('daily_reset_time = $2::time');

    query.mockClear();
    await repository.deactivate(8, 1, now);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
