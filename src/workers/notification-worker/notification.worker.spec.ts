import { ClockService } from '../../core/clock/clock.service';
import { NotificationWorkerRepository } from './notification-worker.repository';
import { NotificationWorker } from './notification.worker';

describe('NotificationWorker', () => {
  it('dispatches claimed rows through the typed repository contract', async () => {
    const now = new Date('2026-10-05T21:58:30.012Z');
    const repository = {
      claimPending: jest.fn().mockResolvedValue([
        {
          notification_id: '00000000-0000-4000-8000-000000000042',
          channel: 'sms',
          notification_type: 'welcome',
          recipient: '+21600000000',
          notification_content: 'Bienvenue',
          attempt_count: 1,
        },
      ]),
      markDelivered: jest.fn().mockResolvedValue(true),
      markAttemptFailed: jest.fn(),
    } as unknown as NotificationWorkerRepository;
    const clock = {
      now: jest.fn().mockReturnValue(now),
    } as unknown as ClockService;

    await new NotificationWorker(repository, clock, {
      increment: jest.fn(),
    } as any).processPendingNotifications();

    expect(repository.claimPending).toHaveBeenCalledWith(now);
    expect(repository.markDelivered).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      expect.stringMatching(/^msg_[a-f0-9]{16}$/),
      now,
      1,
    );
  });
});
