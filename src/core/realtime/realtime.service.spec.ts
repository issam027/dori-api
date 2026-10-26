import { firstValueFrom } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const now = new Date('2026-10-25T14:00:00.000Z');
  const queueId = '00000000-0000-4000-8000-000000000001';
  const clock = {
    now: jest.fn(() => now),
  } as unknown as ClockService;
  const repository = {
    claimPending: jest.fn().mockResolvedValue([]),
    markPublished: jest.fn(),
    markFailed: jest.fn(),
    deletePublishedBefore: jest.fn(),
    findReplay: jest.fn().mockResolvedValue([]),
  };

  it('delivers only matching Redis events to a display stream', async () => {
    let onMessage: ((channel: string, message: string) => void) | undefined;
    const subscriber = {
      status: 'ready',
      on: jest.fn((event: string, callback: typeof onMessage) => {
        if (event === 'message') onMessage = callback;
      }),
      subscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = { duplicate: jest.fn(() => subscriber) };
    const service = new RealtimeService(
      clock,
      repository as never,
      redis as never,
    );
    const stream = await service.streamDisplay(queueId);
    const eventPromise = firstValueFrom(stream);

    onMessage?.(
      'dori:queue-events',
      JSON.stringify({
        id: '00000000-0000-4000-8000-000000000010',
        event: 'queue_position_changed',
        queueId,
        payload: { queueId },
      }),
    );
    onMessage?.(
      'dori:queue-events',
      JSON.stringify({
        id: '00000000-0000-4000-8000-000000000011',
        event: 'queue_display_changed',
        queueId,
        payload: { queueId, reason: 'registration_called' },
      }),
    );

    await expect(eventPromise).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000011',
      type: 'queue_display_changed',
      retry: 3000,
      data: { queueId, reason: 'registration_called' },
    });
    expect(subscriber.subscribe).toHaveBeenCalledWith('dori:queue-events');
    await service.onModuleDestroy();
  });

  it('shares one Redis subscription across all SSE streams', async () => {
    const subscriber = {
      status: 'ready',
      on: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = { duplicate: jest.fn(() => subscriber) };
    const service = new RealtimeService(
      clock,
      repository as never,
      redis as never,
    );

    await Promise.all([
      service.streamDisplay(queueId),
      service.streamTracking(queueId),
      service.streamDisplay('00000000-0000-4000-8000-000000000002'),
    ]);

    expect(redis.duplicate).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    await service.onModuleDestroy();
  });

  it('falls back to process-local SSE delivery without Redis', async () => {
    const localEvent = {
      event_id: '00000000-0000-4000-8000-000000000012',
      event_type: 'queue_position_changed',
      queue_id: queueId,
      payload: { queueId, timestamp: now.toISOString() },
    };
    const repository = {
      claimPending: jest.fn().mockResolvedValue([localEvent]),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
      deletePublishedBefore: jest.fn(),
    };
    const localService = new RealtimeService(
      clock,
      repository as never,
      undefined,
    );
    const localStream = await localService.streamTracking(queueId);
    const localEventPromise = firstValueFrom(localStream);
    await localService.dispatchPending();

    await expect(localEventPromise).resolves.toEqual({
      id: localEvent.event_id,
      type: 'queue_position_changed',
      retry: 3000,
      data: { queueId, timestamp: now.toISOString() },
    });
  });

  it('keeps a failed publication pending and resolves the dispatch', async () => {
    const event = {
      event_id: '00000000-0000-4000-8000-000000000013',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const failingRepository = {
      claimPending: jest.fn().mockResolvedValue([event]),
      markPublished: jest.fn(),
      markFailed: jest.fn().mockResolvedValue(undefined),
      deletePublishedBefore: jest.fn(),
    };
    const redis = {
      status: 'ready',
      publish: jest.fn().mockRejectedValue(new Error('unavailable')),
    };
    const service = new RealtimeService(
      clock,
      failingRepository as never,
      redis as never,
    );

    await expect(service.dispatchPending()).resolves.toBeUndefined();
    expect(failingRepository.markFailed).toHaveBeenCalledWith(
      event.event_id,
      now,
    );
    expect(failingRepository.markPublished).not.toHaveBeenCalled();
    expect(failingRepository.deletePublishedBefore).not.toHaveBeenCalled();
  });

  it('purges published events only during maintenance dispatches', async () => {
    const maintenanceRepository = {
      claimPending: jest.fn().mockResolvedValue([]),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
      deletePublishedBefore: jest.fn(),
    };
    const service = new RealtimeService(
      clock,
      maintenanceRepository as never,
      undefined,
    );

    await service.dispatchPending(true);

    expect(maintenanceRepository.deletePublishedBefore).toHaveBeenCalledWith(
      new Date('2026-10-24T14:00:00.000Z'),
    );
  });
});
