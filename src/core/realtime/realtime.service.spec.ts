import { MessageEvent } from '@nestjs/common';
import { Subject, filter } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { DatabaseChange } from '../database/database-events.service';
import { RealtimeService } from './realtime.service';

describe('event-driven queue SSE', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());
  function setup() {
    const changes = new Subject<DatabaseChange>();
    const bus = {
      connected: true,
      changes: (keys: string[]) =>
        changes.pipe(
          filter((e) => e.key === 'recovery' || keys.includes(e.key)),
        ),
    };
    const current = {
      event_id: 'one',
      queue_id: 'queue',
      event_type: 'queue_display_changed',
      payload: { queueId: 'queue' },
      version: 1,
    };
    const repository = { findTopicState: jest.fn().mockResolvedValue(current) };
    const service = new RealtimeService(
      new ClockService(),
      repository as never,
      bus as never,
    );
    return { service, repository, current, changes, bus };
  }
  it('reads on changes, never on idle heartbeats', async () => {
    const { service, repository, current, changes } = setup();
    const events: MessageEvent[] = [];
    const subscription = (await service.streamDisplay('queue')).subscribe((e) =>
      events.push(e),
    );
    await jest.advanceTimersByTimeAsync(0);
    const calls = repository.findTopicState.mock.calls.length;
    await jest.advanceTimersByTimeAsync(30_000);
    expect(repository.findTopicState).toHaveBeenCalledTimes(calls);
    expect(events.filter((e) => e.type === 'heartbeat')).toHaveLength(2);
    repository.findTopicState.mockResolvedValue({
      ...current,
      event_id: 'two',
    });
    changes.next({ key: 'queue:queue:queue_display_changed' });
    await jest.advanceTimersByTimeAsync(0);
    expect(events.at(-1)).toMatchObject({
      id: 'two',
      type: 'queue_display_changed',
    });
    expect(repository.findTopicState).toHaveBeenCalledTimes(calls + 1);
    subscription.unsubscribe();
  });
  it('shares one read across fifty clients and recovers missed events on listener reconnect', async () => {
    const { service, repository, current, changes } = setup();
    const streams = await Promise.all(
      Array.from({ length: 50 }, () => service.streamDisplay('queue')),
    );
    const next = jest.fn();
    const subscriptions = streams.map((s) => s.subscribe(next));
    await jest.advanceTimersByTimeAsync(0);
    const calls = repository.findTopicState.mock.calls.length;
    repository.findTopicState.mockResolvedValue({
      ...current,
      event_id: 'two',
    });
    changes.next({ key: 'recovery' });
    await jest.advanceTimersByTimeAsync(0);
    expect(repository.findTopicState).toHaveBeenCalledTimes(calls + 1);
    expect(next).toHaveBeenCalledTimes(50);
    subscriptions.forEach((s) => s.unsubscribe());
    changes.next({ key: 'recovery' });
    await jest.advanceTimersByTimeAsync(0);
    expect(repository.findTopicState).toHaveBeenCalledTimes(calls + 1);
  });
  it.each(['streamDisplay', 'streamTracking'] as const)(
    'closes %s on revocation and exact expiry',
    async (method) => {
      const { service, changes } = setup();
      const authorize = jest.fn().mockResolvedValue(undefined);
      const complete = jest.fn();
      (
        await service[method]('queue', undefined, {
          authorize,
          expiresAt: new Date(now.getTime() + 60_000),
        })
      ).subscribe({ complete });
      await jest.advanceTimersByTimeAsync(0);
      const calls = authorize.mock.calls.length;
      await jest.advanceTimersByTimeAsync(15_000);
      expect(authorize).toHaveBeenCalledTimes(calls);
      authorize.mockRejectedValue(new Error('revoked'));
      changes.next({ key: 'authorization' });
      await jest.advanceTimersByTimeAsync(0);
      expect(complete).toHaveBeenCalledTimes(1);
      const expired = jest.fn();
      (
        await service[method]('queue', undefined, {
          authorize: async () => undefined,
          expiresAt: new Date(now.getTime() + 17_000),
        })
      ).subscribe({ complete: expired });
      await jest.advanceTimersByTimeAsync(2000);
      expect(expired).toHaveBeenCalledTimes(1);
    },
  );
  it('suppresses healthy heartbeats while the database listener is disconnected', async () => {
    const { service, bus } = setup();
    bus.connected = false;
    const next = jest.fn();
    const subscription = (await service.streamDisplay('queue')).subscribe(next);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(next).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
});
