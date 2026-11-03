import { Subject, filter } from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import { EdgeInstallationsRealtimeService } from './edge-installations-realtime.service';

describe('event-driven installation administration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it('does not read or authorize on heartbeats and coalesces installation changes', async () => {
    const changes = new Subject<{ key: string }>();
    const bus = {
      connected: true,
      changes: (keys: string[]) =>
        changes.pipe(filter((event) => keys.includes(event.key))),
    };
    const authorize = jest.fn().mockResolvedValue(undefined);
    const next = jest.fn();
    const complete = jest.fn();
    const service = new EdgeInstallationsRealtimeService(
      new ClockService(),
      bus as never,
    );
    const subscription = (
      await service.stream({
        authorize,
        expiresAt: new Date(Date.now() + 120000),
      })
    ).subscribe({ next, complete });
    await jest.advanceTimersByTimeAsync(30000);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
    changes.next({ key: 'edge-installations' });
    changes.next({ key: 'edge-installations' });
    await jest.advanceTimersByTimeAsync(100);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'edge_installations_changed' }),
    );
    authorize.mockRejectedValue(new Error('revoked'));
    changes.next({ key: 'authorization' });
    await jest.advanceTimersByTimeAsync(0);
    expect(complete).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
});
