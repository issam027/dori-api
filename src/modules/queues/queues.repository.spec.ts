import { DataSource } from 'typeorm';
import { QueuesRepository } from './queues.repository';

describe('QueuesRepository', () => {
  it('loads an active queue together with inherited site configuration', async () => {
    const row = { queue_id: 5, queue_code: 'A', site_id: 2 };
    const dataSource = {
      query: jest.fn().mockResolvedValue([row]),
    } as unknown as DataSource;

    const result = await new QueuesRepository(dataSource).findById(5);

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
    expect(query.mock.calls[1][0]).toContain('$15::int[]');
    expect(query.mock.calls[1][0]).toContain('$22::time');
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
    expect(query).toHaveBeenCalledTimes(6);
  });

  it('assigns a user to the parent site and queue in one transaction', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    await new QueuesRepository(dataSource).assignOperator(
      8,
      2,
      4,
      1,
      new Date('2026-10-15T12:00:00Z'),
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain(
      'INSERT INTO dori_user_site_assignment',
    );
    expect(query.mock.calls[2][0]).toContain(
      'INSERT INTO dori_user_queue_assignment',
    );
  });

  it('accepts active operator and kiosk roles for queue assignment', async () => {
    const query = jest.fn().mockResolvedValue([{ user_id: 4 }]);
    const dataSource = { query } as unknown as DataSource;

    await expect(
      new QueuesRepository(dataSource).hasQueueAssignableRole(4),
    ).resolves.toBe(true);
    expect(query.mock.calls[0][0]).toContain(
      "r.role_name IN ('operator', 'kiosk')",
    );
  });

  it('removes the site assignment only when no queue assignment remains', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ site_id: 2 }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ user_id: 4 }])
      .mockResolvedValueOnce([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    await expect(
      new QueuesRepository(dataSource).removeOperator(8, 4),
    ).resolves.toBe(true);

    expect(query.mock.calls[3][0]).toContain('NOT EXISTS');
    expect(query.mock.calls[3][0]).toContain(
      'DELETE FROM dori_user_site_assignment',
    );
  });

  it('locks the queue and carries every open registration through today', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    await new QueuesRepository(dataSource).reset({
      queueId: 4,
      userId: 2,
      now: new Date('2026-10-06T03:00:00Z'),
      businessDate: '2026-10-05',
      targetBusinessDate: '2026-10-05',
      trackingValidUntil: new Date('2026-10-07T03:00:00Z'),
      carryOver: true,
      resetMode: 'carry_over_open',
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(query.mock.calls[2][0]).toContain('business_date <= $3::date');
    expect(query.mock.calls[2][0]).toContain("ticket_number LIKE '!%'");
    expect(query.mock.calls[3][0]).toContain(
      "ticket_number = '!' || ticket_number",
    );
    expect(query.mock.calls[3][0]).toContain("status = 'in_progress'");
    expect(query.mock.calls[3][0]).toContain('served_by_session_id = NULL');
    expect(query.mock.calls[3][0]).toContain('business_date <= $2::date');
    expect(query.mock.calls[3][0]).toContain("ticket_number NOT LIKE '!%'");
    expect(query.mock.calls[3][1][0]).toBe('2026-10-05');
  });
});
