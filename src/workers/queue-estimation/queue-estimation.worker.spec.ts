import { ClockService } from '../../core/clock/clock.service';
import { QueueEstimationWorkerRepository } from './queue-estimation.repository';
import { QueueEstimationWorker } from './queue-estimation.worker';

describe('QueueEstimationWorker', () => {
  it('aggregates each queue for its current local activity date', async () => {
    const now = new Date('2026-10-20T23:30:00Z');
    const repository = {
      findActiveQueues: jest.fn().mockResolvedValue([
        {
          site_id: '00000000-0000-4000-8000-000000000002',
          queue_id: '00000000-0000-4000-8000-000000000004',
          timezone: 'Europe/Berlin',
        },
      ]),
      aggregateQueue: jest.fn().mockResolvedValue(true),
    } as unknown as QueueEstimationWorkerRepository;
    const clock = {
      now: jest.fn().mockReturnValue(now),
      dateInTimezone: jest.fn().mockReturnValue('2026-10-21'),
    } as unknown as ClockService;

    await new QueueEstimationWorker(repository, clock).handleQueueEstimation();

    expect(repository.aggregateQueue).toHaveBeenCalledWith({
      siteId: '00000000-0000-4000-8000-000000000002',
      queueId: '00000000-0000-4000-8000-000000000004',
      activityDate: '2026-10-21',
      now,
    });
  });

  it('continues when one queue aggregation fails', async () => {
    const repository = {
      findActiveQueues: jest.fn().mockResolvedValue([
        {
          site_id: '00000000-0000-4000-8000-000000000002',
          queue_id: '00000000-0000-4000-8000-000000000004',
          timezone: 'UTC',
        },
        {
          site_id: '00000000-0000-4000-8000-000000000002',
          queue_id: '00000000-0000-4000-8000-000000000005',
          timezone: 'UTC',
        },
      ]),
      aggregateQueue: jest
        .fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce(true),
    } as unknown as QueueEstimationWorkerRepository;
    const clock = {
      now: jest.fn().mockReturnValue(new Date('2026-10-20T10:00:00Z')),
      dateInTimezone: jest.fn().mockReturnValue('2026-10-20'),
    } as unknown as ClockService;

    await new QueueEstimationWorker(repository, clock).handleQueueEstimation();

    expect(repository.aggregateQueue).toHaveBeenCalledTimes(2);
  });
});
