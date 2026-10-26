import { firstValueFrom } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const now = new Date('2026-10-25T14:00:00.000Z');
  const queueId = '00000000-0000-4000-8000-000000000001';
  const clock = {
    now: jest.fn(() => now),
  } as unknown as ClockService;

  it('publishes a display invalidation to Redis', async () => {
    const redis = {
      status: 'ready',
      publish: jest.fn().mockResolvedValue(1),
    };
    const service = new RealtimeService(clock, redis as never);

    await service.emitQueueDisplayChanged(queueId, 'registration_created');

    expect(redis.publish).toHaveBeenCalledWith(
      'dori:queue-events',
      JSON.stringify({
        event: 'queue_display_changed',
        queueId,
        payload: {
          queueId,
          reason: 'registration_created',
          timestamp: now.toISOString(),
        },
      }),
    );
  });

  it('publishes a tracking invalidation to Redis', async () => {
    const redis = {
      status: 'ready',
      publish: jest.fn().mockResolvedValue(1),
    };
    const service = new RealtimeService(clock, redis as never);

    await service.emitQueuePositionChanged(queueId);

    expect(redis.publish).toHaveBeenCalledWith(
      'dori:queue-events',
      JSON.stringify({
        event: 'queue_position_changed',
        queueId,
        payload: { queueId, timestamp: now.toISOString() },
      }),
    );
  });

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
    const service = new RealtimeService(clock, redis as never);
    const stream = await service.streamDisplay(queueId);
    const eventPromise = firstValueFrom(stream);

    onMessage?.(
      'dori:queue-events',
      JSON.stringify({
        event: 'queue_position_changed',
        queueId,
        payload: { queueId },
      }),
    );
    onMessage?.(
      'dori:queue-events',
      JSON.stringify({
        event: 'queue_display_changed',
        queueId,
        payload: { queueId, reason: 'registration_called' },
      }),
    );

    await expect(eventPromise).resolves.toEqual({
      type: 'queue_display_changed',
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
    const service = new RealtimeService(clock, redis as never);

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
    const service = new RealtimeService(clock);
    const stream = await service.streamTracking(queueId);
    const eventPromise = firstValueFrom(stream);

    await service.emitQueuePositionChanged(queueId);

    await expect(eventPromise).resolves.toEqual({
      type: 'queue_position_changed',
      data: { queueId, timestamp: now.toISOString() },
    });
  });
});
