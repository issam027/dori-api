import { DataSource } from 'typeorm';
import { NotificationWorkerRepository } from './notification-worker.repository';

describe('NotificationWorkerRepository', () => {
  it.each([
    ['flat rows', (rows: unknown[]) => rows],
    ['TypeORM tuple', (rows: unknown[]) => [rows, rows.length]],
  ])('normalizes %s returned by UPDATE RETURNING', async (_label, shape) => {
    const rows = [{ notification_id: 7, channel: 'sms', recipient: '+216' }];
    const query = jest.fn().mockResolvedValue(shape(rows));
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
      query: jest.fn(),
    } as unknown as DataSource;

    const result = await new NotificationWorkerRepository(
      dataSource,
    ).claimPending(new Date('2026-10-06T12:00:00Z'));

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("$1::timestamptz - INTERVAL '5 minutes'"),
      [new Date('2026-10-06T12:00:00Z')],
    );
  });
});
