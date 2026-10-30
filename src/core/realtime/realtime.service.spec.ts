import { firstValueFrom } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const now = new Date('2026-10-25T14:00:00.000Z');
  const queueId = '00000000-0000-4000-8000-000000000001';
  const clock = { now: jest.fn(() => now) } as unknown as ClockService;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits when the display topic version changes', async () => {
    const initial = {
      version: '1',
      event_id: '00000000-0000-4000-8000-000000000010',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const changed = {
      ...initial,
      version: '2',
      event_id: '00000000-0000-4000-8000-000000000011',
      payload: { queueId, reason: 'registration_called' },
    };
    const repository = {
      findTopicState: jest
        .fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValue(changed),
    };
    const service = new RealtimeService(clock, repository as never);
    const stream = await service.streamDisplay(queueId);
    const eventPromise = firstValueFrom(stream);

    await jest.advanceTimersByTimeAsync(2000);

    await expect(eventPromise).resolves.toEqual({
      id: changed.event_id,
      type: changed.event_type,
      retry: 3000,
      data: changed.payload,
    });
  });

  it('emits the current topic immediately after an EventSource reconnection', async () => {
    const current = {
      version: '3',
      event_id: '00000000-0000-4000-8000-000000000012',
      event_type: 'queue_position_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const repository = { findTopicState: jest.fn().mockResolvedValue(current) };
    const service = new RealtimeService(clock, repository as never);
    const stream = await service.streamTracking(
      queueId,
      '00000000-0000-4000-8000-000000000011',
    );
    const eventPromise = firstValueFrom(stream);

    await jest.advanceTimersByTimeAsync(2000);

    await expect(eventPromise).resolves.toMatchObject({ id: current.event_id });
  });

  it('does not emit a business event while the topic is unchanged', async () => {
    const current = {
      version: '1',
      event_id: '00000000-0000-4000-8000-000000000013',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const repository = { findTopicState: jest.fn().mockResolvedValue(current) };
    const service = new RealtimeService(clock, repository as never);
    const stream = await service.streamDisplay(queueId);
    const eventPromise = firstValueFrom(stream);

    await jest.advanceTimersByTimeAsync(15000);

    await expect(eventPromise).resolves.toEqual({
      type: 'heartbeat',
      data: { timestamp: now.toISOString() },
    });
  });

  it.each(['streamDisplay', 'streamTracking'] as const)(
    'closes %s at credential expiration even without business events',
    async (method) => {
      const repository = { findTopicState: jest.fn().mockResolvedValue(null) };
      const authorize = jest.fn().mockResolvedValue(undefined);
      const stream = await new RealtimeService(clock, repository as never)[
        method
      ](queueId, undefined, {
        authorize,
        expiresAt: new Date(now.getTime() + 3500),
      });
      const complete = jest.fn();
      const next = jest.fn();
      stream.subscribe({ next, complete });
      await jest.advanceTimersByTimeAsync(3500);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
      expect(authorize).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(20000);
      expect(repository.findTopicState).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['streamDisplay', 'streamTracking'] as const)(
    'closes %s on revocation and cancels polling and heartbeats',
    async (method) => {
      const repository = { findTopicState: jest.fn().mockResolvedValue(null) };
      const authorize = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('revoked'));
      const stream = await new RealtimeService(clock, repository as never)[
        method
      ](queueId, undefined, {
        authorize,
        expiresAt: new Date(now.getTime() + 60000),
      });
      const complete = jest.fn();
      const next = jest.fn();
      const error = jest.fn();
      stream.subscribe({ next, complete, error });
      await jest.advanceTimersByTimeAsync(20000);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(authorize).toHaveBeenCalledTimes(2);
      expect(repository.findTopicState).toHaveBeenCalledTimes(2);
    },
  );

  it('stops all checks when the client disconnects', async () => {
    const repository = { findTopicState: jest.fn().mockResolvedValue(null) };
    const authorize = jest.fn().mockResolvedValue(undefined);
    const stream = await new RealtimeService(
      clock,
      repository as never,
    ).streamDisplay(queueId, undefined, {
      authorize,
      expiresAt: new Date(now.getTime() + 60000),
    });
    const subscription = stream.subscribe();
    await jest.advanceTimersByTimeAsync(2000);
    subscription.unsubscribe();
    await jest.advanceTimersByTimeAsync(20000);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(repository.findTopicState).toHaveBeenCalledTimes(2);
  });
});
