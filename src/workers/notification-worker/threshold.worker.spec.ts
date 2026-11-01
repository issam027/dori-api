import { ThresholdWorker } from './threshold.worker';
import { NotificationWorkerRepository } from './notification-worker.repository';
import { NotificationsService } from '../../modules/notifications/notifications.service';

describe('ThresholdWorker', () => {
  it('evaluates eligible queues and isolates an individual queue failure', async () => {
    const repository = {
      findThresholdQueues: jest
        .fn()
        .mockResolvedValue([{ queue_id: 'one' }, { queue_id: 'two' }]),
    };
    const notifications = {
      evaluateQueueThresholds: jest
        .fn()
        .mockRejectedValueOnce(new Error('one queue unavailable'))
        .mockResolvedValue(undefined),
    };
    const worker = new ThresholdWorker(
      repository as unknown as NotificationWorkerRepository,
      notifications as unknown as NotificationsService,
    );
    await worker.evaluateThresholds();
    expect(notifications.evaluateQueueThresholds.mock.calls).toEqual([
      ['one'],
      ['two'],
    ]);
  });
});
