import { DataSource } from 'typeorm';
import { NotificationWorkerRepository } from './notification-worker.repository';

describe('NotificationWorkerRepository', () => {
  it('finalizes expired processing leases at the attempt limit instead of excluding them', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new NotificationWorkerRepository({
      transaction: async (
        work: (manager: { query: typeof query }) => Promise<unknown>,
      ) => work({ query }),
    } as unknown as DataSource);
    await expect(
      repository.claimPending(new Date('2026-10-30T12:00:00Z')),
    ).resolves.toEqual([]);
    const sql = query.mock.calls[0][0] as string;
    const candidates = sql.slice(0, sql.indexOf(', updated AS'));
    expect(candidates).not.toContain('attempt_count < 3');
    expect(sql).toContain(
      "CASE WHEN n.attempt_count >= 3 THEN 'failed' ELSE 'processing' END",
    );
    expect(sql).toContain(
      "SELECT * FROM updated WHERE notification_status = 'processing'",
    );
  });

  it('does not finalize a claim that was already reclaimed by another worker', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new NotificationWorkerRepository({
      query,
    } as unknown as DataSource);
    const now = new Date('2026-10-30T12:00:00Z');
    await expect(
      repository.markDelivered('notification', 'message', now, 2),
    ).resolves.toBe(false);
    expect(query.mock.calls[0][0]).toContain(
      "notification_status = 'processing' AND attempt_count = $4",
    );
    expect(query.mock.calls[0][1]).toEqual(['message', now, 'notification', 2]);
    await expect(
      repository.markAttemptFailed('notification', true, 'failure', now, 3),
    ).resolves.toBe(false);
    expect(query.mock.calls[1][0]).toContain(
      "notification_status = 'processing' AND attempt_count = $5",
    );
  });
  it.each([
    ['flat rows', (rows: unknown[]) => rows],
    ['TypeORM tuple', (rows: unknown[]) => [rows, rows.length]],
  ])('normalizes %s returned by UPDATE RETURNING', async (_label, shape) => {
    const rows = [
      {
        notification_id: '00000000-0000-4000-8000-000000000007',
        channel: 'sms',
        recipient: '+216',
      },
    ];
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
