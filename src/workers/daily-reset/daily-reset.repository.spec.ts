import { DataSource } from 'typeorm';
import { DailyResetRepository } from './daily-reset.repository';

describe('DailyResetRepository', () => {
  it('runs a reset once under its transaction lock', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([[{ queue_id: 4 }], 1])
      .mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;
    const now = new Date('2026-10-06T03:00:00Z');

    const executed = await new DailyResetRepository(dataSource).execute({
      queueId: 4,
      businessDate: '2026-10-05',
      nextBusinessDate: '2026-10-06',
      trackingValidUntil: new Date('2026-10-07T03:00:00Z'),
      now,
      carryOverWaiting: false,
      resetMode: 'close_all',
    });

    expect(executed).toBe(true);
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
      queueId: 4,
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
});
