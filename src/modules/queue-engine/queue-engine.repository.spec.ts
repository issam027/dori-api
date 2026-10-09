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
    expect(query.mock.calls[1][0]).toContain('is_active = FALSE');
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
});
