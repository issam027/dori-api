import { DataSource } from 'typeorm';
import { ClockService } from '../../core/clock/clock.service';
import { NotificationWorker } from './notification.worker';

describe('NotificationWorker', () => {
  it('types the claim timestamp before subtracting the stale-processing interval', async () => {
    const claimTime = new Date('2026-10-05T21:58:30.012Z');
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn(async (callback) => callback({ query })),
    } as unknown as DataSource;
    const clockService = {
      now: jest.fn().mockReturnValue(claimTime),
    } as unknown as ClockService;

    const worker = new NotificationWorker(dataSource, clockService);

    await worker.processPendingNotifications();

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "processing_started_at < $1::timestamptz - INTERVAL '5 minutes'",
      ),
      [claimTime],
    );
  });
});
