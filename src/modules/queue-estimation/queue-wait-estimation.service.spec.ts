import { QueueWaitEstimationRepository } from './queue-wait-estimation.repository';
import { QueueWaitEstimationService } from './queue-wait-estimation.service';

describe('QueueWaitEstimationService', () => {
  const registration = {
    registration_id: '00000000-0000-4000-8000-000000000012',
    site_id: '00000000-0000-4000-8000-000000000002',
    queue_id: '00000000-0000-4000-8000-000000000004',
    business_date: '2026-10-20',
    average_wait_time: 10,
  };
  const now = new Date('2026-10-20T10:00:00Z');

  it('uses identical estimates for a batch and individual lookups without per-client SQL', async () => {
    const second = { ...registration, registration_id: 'second' };
    const repository = {
      findOperationalPositions: jest.fn().mockResolvedValue(
        new Map([
          [registration.registration_id, 3],
          ['second', 1],
        ]),
      ),
      findOperationalPosition: jest.fn().mockResolvedValue(3),
      countActiveThreads: jest.fn().mockResolvedValue(2),
      findBestStat: jest.fn().mockResolvedValue(null),
    };
    const service = new QueueWaitEstimationService(repository as never);
    const estimates = await service.estimateMany([registration, second], now);
    expect(repository.findOperationalPositions).toHaveBeenCalledTimes(1);
    expect(repository.countActiveThreads).toHaveBeenCalledTimes(1);
    expect(repository.findBestStat).toHaveBeenCalledTimes(1);
    expect(estimates.get('second')).toMatchObject({
      position: 1,
      estimatedWaitMinutes: 0,
    });
    expect(estimates.get(registration.registration_id)).toEqual(
      await service.estimate(registration, now),
    );
  });

  it('uses the daily P50 in minutes and the operational position', async () => {
    const repository = {
      findOperationalPosition: jest.fn().mockResolvedValue(5),
      countActiveThreads: jest.fn().mockResolvedValue(2),
      findBestStat: jest.fn().mockResolvedValue({
        activity_date: '2026-10-20',
        cycle_p50_minutes: 6,
        sample_size: 35,
        is_reliable: true,
        calculated_at: new Date('2026-10-20T09:55:00Z'),
      }),
    } as unknown as QueueWaitEstimationRepository;

    await expect(
      new QueueWaitEstimationService(repository).estimate(registration, now),
    ).resolves.toMatchObject({
      position: 5,
      estimatedWaitMinutes: 10,
      method: 'queue_daily_p50',
      isReliable: true,
    });
  });

  it('uses the last calculated value when today has not been aggregated', async () => {
    const repository = {
      findOperationalPosition: jest.fn().mockResolvedValue(3),
      countActiveThreads: jest.fn().mockResolvedValue(1),
      findBestStat: jest.fn().mockResolvedValue({
        activity_date: '2026-10-19',
        cycle_p50_minutes: 4,
        sample_size: 20,
        is_reliable: false,
        calculated_at: new Date('2026-10-19T17:00:00Z'),
      }),
    } as unknown as QueueWaitEstimationRepository;

    await expect(
      new QueueWaitEstimationService(repository).estimate(registration, now),
    ).resolves.toMatchObject({
      estimatedWaitMinutes: 10,
      method: 'last_calculated',
    });
  });

  it('returns an unavailable estimate when no desk is active', async () => {
    const repository = {
      findOperationalPosition: jest.fn().mockResolvedValue(2),
      countActiveThreads: jest.fn().mockResolvedValue(0),
      findBestStat: jest.fn().mockResolvedValue(null),
    } as unknown as QueueWaitEstimationRepository;

    await expect(
      new QueueWaitEstimationService(repository).estimate(registration, now),
    ).resolves.toMatchObject({
      estimatedWaitMinutes: null,
      method: 'unavailable',
    });
  });
});
