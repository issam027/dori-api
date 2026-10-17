import { DataSource } from 'typeorm';
import { QueueEngineRepository } from './queue-engine.repository';

describe('QueueEngineRepository', () => {
  it('returns the configured threads and active sessions', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ thread_count: 3 }])
      .mockResolvedValueOnce([{ session_id: 7, thread_number: 2 }]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    const state = await repository.findThreadState(4);

    expect(state?.threadCount).toBe(3);
    expect(state?.sessions).toHaveLength(1);
  });

  it('closes served and no-show registrations through controlled transitions', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-06T12:00:00Z');

    await repository.closeRegistration(3, 'served', now);
    await repository.closeRegistration(4, 'no_show', now);

    expect(query.mock.calls[0][0]).toContain("status = 'served'");
    expect(query.mock.calls[1][0]).toContain("status = 'no_show'");
    expect(query.mock.calls[1][0]).not.toContain('is_active');
  });

  it('binds pagination for active session lists', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await repository.findSessionPage({
      queueId: 5,
      sortField: 'qs.connected_at',
      sortOrder: 'DESC',
      pageSize: 10,
      offset: 20,
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $2 OFFSET $3'),
      [5, 10, 20],
    );
  });

  it('persists the complete counter name when opening a session', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        session_id: 8,
        queue_id: 5,
        user_id: 2,
        thread_number: 1,
        counter_name: 'Bureau A',
      },
    ]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-15T09:00:00Z');

    const session = await repository.createSession({
      queueId: 5,
      userId: 2,
      threadNumber: 1,
      counterName: 'Bureau A',
      mode: 'active',
      now,
    });

    expect(query.mock.calls[0][0]).toContain('counter_name');
    expect(query.mock.calls[0][1]).toEqual([
      5,
      2,
      1,
      'Bureau A',
      'active',
      now,
    ]);
    expect(session.counter_name).toBe('Bureau A');
  });

  it('selects and transitions the next candidate in one transaction', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ registration_id: 9, score: '42.5' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          registration_id: 9,
          ticket_number: 'A-009',
          status: 'in_progress',
          notes_count: 0,
        },
      ]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const repository = new QueueEngineRepository(dataSource);

    const result = await repository.callNext({
      queueId: 2,
      sessionId: 4,
      userId: 12,
      businessDate: '2026-10-06',
      now: new Date('2026-10-06T12:00:00Z'),
      baseWalkin: 0,
      baseAppointment: 60,
      rateWalkin: 1,
      rateAppointment: 1,
    });

    expect(result?.registration_id).toBe(9);
    expect(result?.score).toBe(42.5);
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0][0]).toContain('$6::date');
    expect(query.mock.calls[1][0]).toContain('served_by_session_id = $1');
    expect(query.mock.calls[1][0]).toContain('served_by_user_id = $2');
    expect(query.mock.calls[1][1]).toEqual([
      4,
      12,
      new Date('2026-10-06T12:00:00Z'),
      9,
    ]);
  });

  it('binds preview exclusions as an integer array', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ registration_id: 1 }])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await repository.findPreviewCandidates(
      [2, 3],
      new Date('2026-10-06T12:00:00Z'),
      3,
    );

    expect(query.mock.calls[1][0]).toContain('<> ALL($3::int[])');
    expect(query.mock.calls[1][1][2]).toEqual([1]);
  });

  it('restricts regular and early preview candidates to each site business day', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ registration_id: 1 }])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await repository.findPreviewCandidates(
      [2, 3],
      new Date('2026-10-17T23:30:00Z'),
      3,
    );

    for (const call of query.mock.calls) {
      expect(call[0]).toContain(
        'c.business_date = ($2::timestamptz AT TIME ZONE s.timezone)::date',
      );
      expect(call[0]).toContain("c.appointment_status = 'checked_in'");
    }
    expect(query.mock.calls[0][0]).toContain('c.scheduled_time <= $2');
    expect(query.mock.calls[1][0]).toContain('c.scheduled_time > $2');
  });
});
