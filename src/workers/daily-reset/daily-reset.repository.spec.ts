import { DataSource } from 'typeorm';
import { DailyResetRepository } from './daily-reset.repository';

describe('DailyResetRepository', () => {
  it('runs a reset once under its transaction lock', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        [{ queue_id: '00000000-0000-4000-8000-000000000004' }],
        1,
      ])
      .mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const now = new Date('2026-10-06T03:00:00Z');

    const executed = await new DailyResetRepository(dataSource).execute({
      queueId: '00000000-0000-4000-8000-000000000004',
      businessDate: '2026-10-05',
      nextBusinessDate: '2026-10-06',
      trackingValidUntil: new Date('2026-10-07T03:00:00Z'),
      now,
      carryOverWaiting: false,
      resetMode: 'close_all',
    });

    expect(executed).toBe(true);
    expect(query.mock.calls[0][0]).toContain('hashtextextended');
    expect(query.mock.calls[0][1]).toEqual([
      'daily-reset',
      '00000000-0000-4000-8000-000000000004',
    ]);
    expect(query.mock.calls[1][0]).toContain('$2::date');
    expect(query.mock.calls[3][0]).toContain('$3::date');
  });

  it('stops when another instance owns the lock', async () => {
    const query = jest.fn().mockResolvedValue([{ acquired: false }]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const repository = new DailyResetRepository(dataSource);

    const executed = await repository.execute({
      queueId: '00000000-0000-4000-8000-000000000004',
      businessDate: '2026-10-05',
      nextBusinessDate: '2026-10-06',
      trackingValidUntil: new Date(),
      now: new Date(),
      carryOverWaiting: false,
      resetMode: 'close_all',
    });

    expect(executed).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('expires every remaining ticket in close_all mode even when carry-over is enabled', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        [{ queue_id: '00000000-0000-4000-8000-000000000004' }],
        1,
      ])
      .mockResolvedValue([]);
    const repository = new DailyResetRepository({
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource);

    await repository.execute({
      queueId: '00000000-0000-4000-8000-000000000004',
      businessDate: '2026-10-05',
      nextBusinessDate: '2026-10-06',
      trackingValidUntil: new Date('2026-10-07T03:00:00Z'),
      now: new Date('2026-10-06T03:00:00Z'),
      carryOverWaiting: true,
      resetMode: 'close_all',
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3][0]).toContain(
      "status IN ('booked', 'waiting', 'in_progress')",
    );
    expect(query.mock.calls[3][0]).not.toContain("ticket_number = '!' ||");
  });

  it('carries open tickets once with ! in carry_over_open mode', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        [{ queue_id: '00000000-0000-4000-8000-000000000004' }],
        1,
      ])
      .mockResolvedValue([]);
    const repository = new DailyResetRepository({
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource);

    await repository.execute({
      queueId: '00000000-0000-4000-8000-000000000004',
      businessDate: '2026-10-05',
      nextBusinessDate: '2026-10-06',
      trackingValidUntil: new Date('2026-10-07T03:00:00Z'),
      now: new Date('2026-10-06T03:00:00Z'),
      carryOverWaiting: true,
      resetMode: 'carry_over_open',
    });

    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls[3][0]).toContain("ticket_number LIKE '!%'");
    expect(query.mock.calls[4][0]).toContain(
      "ticket_number = '!' || ticket_number",
    );
    expect(query.mock.calls[4][0]).toContain("status = 'in_progress'");
    expect(query.mock.calls[4][0]).toContain('served_by_session_id = NULL');
    expect(query.mock.calls[4][0]).toContain("ticket_number NOT LIKE '!%'");
  });
});
