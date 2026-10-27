import { DataSource } from 'typeorm';
import { QueueEngineRepository } from './queue-engine.repository';

describe('QueueEngineRepository', () => {
  it('calls the best candidate across the operator active site sessions', async () => {
    const now = new Date('2026-10-27T10:00:00Z');
    const queueId = '00000000-0000-4000-8000-000000000002';
    const sessionId = '00000000-0000-4000-8000-000000000003';
    const registrationId = '00000000-0000-4000-8000-000000000004';
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ session_id: sessionId, queue_id: queueId }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          registration_id: registrationId,
          queue_id: queueId,
          session_id: sessionId,
          score: '72.5',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          registration_id: registrationId,
          queue_id: queueId,
          queue_name: 'Accueil',
          session_id: sessionId,
          thread_number: 2,
          ticket_number: 'A042',
          status: 'in_progress',
          notes_count: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource);

    await expect(
      repository.callNextForSite({
        siteId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000005',
        allowedQueueIds: [queueId],
        now,
      }),
    ).resolves.toMatchObject({
      outcome: 'called',
      candidate: {
        registration_id: registrationId,
        queue_id: queueId,
        score: 72.5,
      },
    });

    expect(query.mock.calls[0][0]).toContain("status = 'in_progress'");
    expect(query.mock.calls[2][0]).toContain('ORDER BY score DESC');
    expect(query.mock.calls[2][0]).toContain('FOR UPDATE OF c SKIP LOCKED');
    expect(query.mock.calls[5][1][1]).toBe('queue_display_changed');
    expect(query.mock.calls[6][1][1]).toBe('queue_position_changed');
  });

  it('recalls the current registration and publishes display only', async () => {
    const now = new Date('2026-10-26T10:00:00Z');
    const registrationId = '00000000-0000-4000-8000-000000000001';
    const queueId = '00000000-0000-4000-8000-000000000002';
    const sessionId = '00000000-0000-4000-8000-000000000003';
    const userId = '00000000-0000-4000-8000-000000000004';
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          registration_id: registrationId,
          queue_id: queueId,
          ticket_number: 'A042',
          status: 'in_progress',
          served_by_session_id: sessionId,
        },
      ])
      .mockResolvedValueOnce([
        {
          session_id: sessionId,
          user_id: userId,
          thread_number: 3,
          counter_name: 'Guichet 3',
        },
      ])
      .mockResolvedValueOnce([{ last_recalled_at: now, recall_count: 2 }])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource);

    await expect(
      repository.recallRegistration({ registrationId, userId, now }),
    ).resolves.toMatchObject({
      outcome: 'recalled',
      registration_id: registrationId,
      queue_id: queueId,
      session_id: sessionId,
      recall_count: 2,
    });

    expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(query.mock.calls[1][0]).toContain('disconnected_at IS NULL');
    expect(query.mock.calls[2][0]).toContain('recall_count = recall_count + 1');
    expect(query.mock.calls[3][1][1]).toBe('queue_display_changed');
    expect(query.mock.calls[3][1][2]).toContain('registration_recalled');
    expect(query.mock.calls[3][1][2]).not.toContain('queue_position_changed');
  });

  it('rejects recall when the active session belongs to another user', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          registration_id: '00000000-0000-4000-8000-000000000001',
          queue_id: '00000000-0000-4000-8000-000000000002',
          ticket_number: 'A042',
          status: 'in_progress',
          served_by_session_id: '00000000-0000-4000-8000-000000000003',
        },
      ])
      .mockResolvedValueOnce([
        {
          session_id: '00000000-0000-4000-8000-000000000003',
          user_id: '00000000-0000-4000-8000-000000000099',
          thread_number: 3,
          counter_name: 'Guichet 3',
        },
      ]);
    const repository = new QueueEngineRepository({
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource);

    await expect(
      repository.recallRegistration({
        registrationId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000004',
        now: new Date('2026-10-26T10:00:00Z'),
      }),
    ).resolves.toEqual({ outcome: 'forbidden' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns the configured threads and active sessions', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ thread_count: 3 }])
      .mockResolvedValueOnce([
        {
          session_id: '00000000-0000-4000-8000-000000000007',
          thread_number: 2,
        },
      ]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    const state = await repository.findThreadState(
      '00000000-0000-4000-8000-000000000004',
    );

    expect(state?.threadCount).toBe(3);
    expect(state?.sessions).toHaveLength(1);
  });

  it('closes served and no-show registrations through controlled transitions', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { queue_id: '00000000-0000-4000-8000-000000000001' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { queue_id: '00000000-0000-4000-8000-000000000001' },
      ])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
      transaction: (
        work: (manager: { query: jest.Mock }) => Promise<unknown>,
      ) => work({ query }),
    } as unknown as DataSource);
    const now = new Date('2026-10-06T12:00:00Z');

    await repository.closeRegistration(
      '00000000-0000-4000-8000-000000000003',
      'served',
      now,
    );
    await repository.closeRegistration(
      '00000000-0000-4000-8000-000000000004',
      'no_show',
      now,
    );

    expect(query.mock.calls[0][0]).toContain("status = 'served'");
    expect(query.mock.calls[3][0]).toContain("status = 'no_show'");
    expect(query.mock.calls[3][0]).not.toContain('is_active');
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
      queueId: '00000000-0000-4000-8000-000000000005',
      sortField: 'qs.connected_at',
      sortOrder: 'DESC',
      pageSize: 10,
      offset: 20,
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $2 OFFSET $3'),
      ['00000000-0000-4000-8000-000000000005', 10, 20],
    );
  });

  it('persists the complete counter name when opening a session', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        session_id: '00000000-0000-4000-8000-000000000008',
        queue_id: '00000000-0000-4000-8000-000000000005',
        user_id: '00000000-0000-4000-8000-000000000002',
        thread_number: 1,
        counter_name: 'Bureau A',
      },
    ]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-15T09:00:00Z');

    const session = await repository.createSession({
      queueId: '00000000-0000-4000-8000-000000000005',
      userId: '00000000-0000-4000-8000-000000000002',
      threadNumber: 1,
      counterName: 'Bureau A',
      mode: 'active',
      now,
    });

    expect(query.mock.calls[0][0]).toContain('counter_name');
    expect(query.mock.calls[0][1]).toEqual([
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000002',
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { session_id: '00000000-0000-4000-8000-000000000004' },
      ])
      .mockResolvedValueOnce([
        {
          registration_id: '00000000-0000-4000-8000-000000000009',
          score: '42.5',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          registration_id: '00000000-0000-4000-8000-000000000009',
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
      queueId: '00000000-0000-4000-8000-000000000002',
      sessionId: '00000000-0000-4000-8000-000000000004',
      userId: '00000000-0000-4000-8000-000000000012',
      businessDate: '2026-10-06',
      now: new Date('2026-10-06T12:00:00Z'),
      baseWalkin: 0,
      baseAppointment: 60,
      rateWalkin: 1,
      rateAppointment: 1,
    });

    expect(result?.registration_id).toBe(
      '00000000-0000-4000-8000-000000000009',
    );
    expect(result?.score).toBe(42.5);
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(query.mock.calls[0][0]).toContain('hashtextextended');
    expect(query.mock.calls[1][0]).toContain('disconnected_at IS NULL');
    expect(query.mock.calls[2][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[2][0]).toContain('$6::date');
    expect(query.mock.calls[3][0]).toContain('served_by_session_id = $1');
    expect(query.mock.calls[3][0]).toContain('served_by_user_id = $2');
    expect(query.mock.calls[3][1]).toEqual([
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000012',
      new Date('2026-10-06T12:00:00Z'),
      '00000000-0000-4000-8000-000000000009',
    ]);
  });

  it('binds preview exclusions as an integer array', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          registration_id: '00000000-0000-4000-8000-000000000001',
          queue_id: '00000000-0000-4000-8000-000000000002',
        },
      ])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await repository.findPreviewCandidates(
      [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
      new Date('2026-10-06T12:00:00Z'),
      3,
    );

    expect(query.mock.calls[1][0]).toContain('<> ALL($3::uuid[])');
    expect(query.mock.calls[1][1][2]).toEqual([
      '00000000-0000-4000-8000-000000000002',
    ]);
  });

  it('does not restrict next preview to one candidate per queue', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        registration_id: '00000000-0000-4000-8000-000000000001',
        queue_id: '00000000-0000-4000-8000-000000000002',
      },
      {
        registration_id: '00000000-0000-4000-8000-000000000002',
        queue_id: '00000000-0000-4000-8000-000000000002',
      },
      {
        registration_id: '00000000-0000-4000-8000-000000000003',
        queue_id: '00000000-0000-4000-8000-000000000003',
      },
      {
        registration_id: '00000000-0000-4000-8000-000000000004',
        queue_id: '00000000-0000-4000-8000-000000000002',
      },
      {
        registration_id: '00000000-0000-4000-8000-000000000005',
        queue_id: '00000000-0000-4000-8000-000000000003',
      },
    ]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await expect(
      repository.findPreviewCandidates(
        [
          '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003',
        ],
        new Date('2026-10-20T09:30:00Z'),
        5,
      ),
    ).resolves.toHaveLength(5);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('PARTITION BY c.queue_id');
    expect(query.mock.calls[0][0]).toContain(
      'ORDER BY score DESC, c.registration_id ASC LIMIT $3',
    );
    expect(query.mock.calls[0][1][2]).toBe(5);
  });

  it('returns only queues with an active session owned by the user', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { queue_id: '00000000-0000-4000-8000-000000000003' },
      ]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await expect(
      repository.findActiveQueueIdsForUser(
        [
          '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003',
        ],
        '00000000-0000-4000-8000-000000000008',
      ),
    ).resolves.toEqual(['00000000-0000-4000-8000-000000000003']);
    expect(query.mock.calls[0][0]).toContain("mode = 'active'");
    expect(query.mock.calls[0][0]).toContain('disconnected_at IS NULL');
    expect(query.mock.calls[0][1]).toEqual([
      [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
      '00000000-0000-4000-8000-000000000008',
    ]);
  });

  it('restricts regular and early preview candidates to each site business day', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { registration_id: '00000000-0000-4000-8000-000000000001' },
      ])
      .mockResolvedValueOnce([]);
    const repository = new QueueEngineRepository({
      query,
    } as unknown as DataSource);

    await repository.findPreviewCandidates(
      [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
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
