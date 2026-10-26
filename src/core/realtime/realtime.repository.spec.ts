import { DataSource } from 'typeorm';
import { RealtimeRepository } from './realtime.repository';

describe('RealtimeRepository', () => {
  it('claims pending events atomically with skip locked', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((work) => work({ query })),
    } as unknown as DataSource;
    const repository = new RealtimeRepository(dataSource);
    const now = new Date('2026-10-26T10:00:00.000Z');

    await repository.claimPending(now, 25);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      [now, 25],
    );
  });

  it('schedules a bounded retry after a publication failure', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = { query } as unknown as DataSource;
    const repository = new RealtimeRepository(dataSource);
    const now = new Date('2026-10-26T10:00:00.000Z');

    await repository.markFailed('00000000-0000-4000-8000-000000000001', now);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INTERVAL '5 minutes'"),
      [now, '00000000-0000-4000-8000-000000000001'],
    );
  });
});
