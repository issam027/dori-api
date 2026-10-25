import { ClockService } from '../clock/clock.service';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const now = new Date('2026-10-25T14:00:00.000Z');
  let service: RealtimeService;
  let emit: jest.Mock;
  let to: jest.Mock;

  beforeEach(() => {
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    service = new RealtimeService({
      now: jest.fn(() => now),
    } as unknown as ClockService);
    service.setServer({ to } as never);
  });

  it('publishes display invalidations only on the display room', async () => {
    const queueId = '00000000-0000-4000-8000-000000000001';

    await service.emitQueueDisplayChanged(queueId, 'registration_called');

    expect(to).toHaveBeenCalledWith(`queue:${queueId}:display`);
    expect(emit).toHaveBeenCalledWith('queue_display_changed', {
      queueId,
      reason: 'registration_called',
      timestamp: now.toISOString(),
    });
  });

  it('publishes position invalidations only on the tracking room', async () => {
    const queueId = '00000000-0000-4000-8000-000000000001';

    await service.emitQueuePositionChanged(queueId);

    expect(to).toHaveBeenCalledWith(`queue:${queueId}:tracking`);
    expect(emit).toHaveBeenCalledWith('queue_position_changed', {
      queueId,
      timestamp: now.toISOString(),
    });
  });

  it('publishes an awaited JSON event to Redis without a local server', async () => {
    const queueId = '00000000-0000-4000-8000-000000000001';
    const redis = {
      status: 'ready',
      publish: jest.fn().mockResolvedValue(1),
    };
    const redisService = new RealtimeService(
      { now: jest.fn(() => now) } as unknown as ClockService,
      redis as never,
    );

    await redisService.emitQueueDisplayChanged(queueId, 'registration_created');

    expect(redis.publish).toHaveBeenCalledWith(
      'dori:queue-events',
      JSON.stringify({
        room: `queue:${queueId}:display`,
        event: 'queue_display_changed',
        payload: {
          queueId,
          reason: 'registration_created',
          timestamp: now.toISOString(),
        },
      }),
    );
  });
});
