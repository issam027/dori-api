import { QueueWaitEstimationRepository } from './queue-wait-estimation.repository';
import { QueueWaitEstimationService } from './queue-wait-estimation.service';

describe('QueueWaitEstimationService facade', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  it('reads individual and batch estimates from the same canonical engine', async () => {
    const row = {
      registration_id: 'ticket',
      position: 3,
      estimated_wait_minutes: 15,
      method: 'queue_daily_p50',
      sample_size: 40,
      is_reliable: true,
      calculated_at: now,
      stats_calculated_at: now,
    };
    const repository = {
      findTicketEstimates: jest.fn().mockResolvedValue([row]),
    };
    const service = new QueueWaitEstimationService(
      repository as unknown as QueueWaitEstimationRepository,
    );
    const batch = await service.estimateMany(
      [{ registration_id: 'ticket' }, { registration_id: 'not-callable' }],
      now,
    );
    const single = await service.estimate({ registration_id: 'ticket' }, now);
    expect(single).toEqual(batch.get('ticket'));
    expect(single).toEqual(
      expect.objectContaining({
        position: 3,
        estimatedWaitMinutes: 15,
        method: 'queue_daily_p50',
        isReliable: true,
      }),
    );
    expect(batch.get('not-callable')).toEqual(
      expect.objectContaining({
        position: null,
        estimatedWaitMinutes: null,
        method: 'unavailable',
        isReliable: false,
      }),
    );
    expect(repository.findTicketEstimates).toHaveBeenNthCalledWith(
      1,
      ['ticket', 'not-callable'],
      now,
    );
  });
  it('uses the queue counts and estimate provided by the engine instead of calculating from caller inputs', async () => {
    const repository = {
      findQueueContext: jest.fn().mockResolvedValue({
        waiting_count: 8,
        active_threads: 2,
        estimated_wait_minutes: 35,
        method: 'last_calculated',
        sample_size: 40,
        is_reliable: false,
        calculated_at: now,
        stats_calculated_at: now,
      }),
    };
    const service = new QueueWaitEstimationService(
      repository as unknown as QueueWaitEstimationRepository,
    );
    expect(
      await service.estimateQueue({
        queueId: 'queue',
        activityDate: '2026-11-02',
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        waitingCount: 8,
        activeThreads: 2,
        estimatedWaitMinutes: 35,
        method: 'last_calculated',
      }),
    );
    expect(repository.findQueueContext).toHaveBeenCalledWith(
      'queue',
      now,
      '2026-11-02',
    );
  });
  it('preserves an unavailable estimate and does not invent a fallback value', async () => {
    const service = new QueueWaitEstimationService({
      findQueueContext: jest.fn().mockResolvedValue(null),
    } as unknown as QueueWaitEstimationRepository);
    expect(
      await service.estimateQueue({
        queueId: 'missing',
        activityDate: '2026-11-02',
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        estimatedWaitMinutes: null,
        method: 'unavailable',
        isReliable: false,
      }),
    );
  });
});
