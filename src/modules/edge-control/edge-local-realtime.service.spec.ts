import { Subject } from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import {
  DatabaseChange,
  DatabaseEventsService,
} from '../../core/database/database-events.service';
import { EdgeLocalStatusService } from './edge-local-status.service';
import { EdgeLocalRealtimeService } from './edge-local-realtime.service';

describe('local agent status SSE', () => {
  const changes = new Subject<DatabaseChange>();
  const status = { getStatus: jest.fn() };
  const events = { connected: true, changes: jest.fn(() => changes) };
  const clock = { now: () => new Date() };
  const active = {
    configured: true,
    deploymentStatus: 'active',
    cloudReachability: 'connected',
  };
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const create = () =>
    new EdgeLocalRealtimeService(
      status as unknown as EdgeLocalStatusService,
      events as unknown as DatabaseEventsService,
      clock as ClockService,
    );
  const authorization = () => ({
    authorize: jest.fn(async () => undefined),
    expiresAt: new Date(Date.now() + 3600000),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    status.getStatus.mockResolvedValue(active);
  });
  afterEach(() => jest.useRealTimers());

  it('shares snapshots across browsers, sends changes directly and never reads for heartbeats', async () => {
    const service = create();
    const one = jest.fn(),
      two = jest.fn();
    const first = service.stream(authorization()).subscribe(one);
    const second = service.stream(authorization()).subscribe(two);
    await flush();
    expect(status.getStatus).toHaveBeenCalledTimes(1);
    expect(one).toHaveBeenCalledWith({
      type: 'edge_local_status',
      data: active,
    });
    await jest.advanceTimersByTimeAsync(30000);
    expect(status.getStatus).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'heartbeat' }),
    );
    status.getStatus.mockResolvedValue({
      ...active,
      deploymentStatus: 'revoked',
    });
    changes.next({ key: 'edge-local-status' });
    await flush();
    expect(status.getStatus).toHaveBeenCalledTimes(2);
    expect(one).toHaveBeenLastCalledWith({
      type: 'edge_local_status',
      data: expect.objectContaining({ deploymentStatus: 'revoked' }),
    });
    expect(two).toHaveBeenLastCalledWith({
      type: 'edge_local_status',
      data: expect.objectContaining({ deploymentStatus: 'revoked' }),
    });
    first.unsubscribe();
    second.unsubscribe();
    const third = service.stream(authorization()).subscribe();
    await flush();
    expect(status.getStatus).toHaveBeenCalledTimes(3);
    third.unsubscribe();
  });

  it('closes expired sessions and releases the shared subscription', async () => {
    const auth = authorization();
    auth.expiresAt = new Date(Date.now() + 1000);
    const complete = jest.fn();
    create().stream(auth).subscribe({ complete });
    await flush();
    await jest.advanceTimersByTimeAsync(1000);
    expect(complete).toHaveBeenCalledTimes(1);
    changes.next({ key: 'edge-local-status' });
    await flush();
    expect(status.getStatus).toHaveBeenCalledTimes(1);
  });

  it('closes when authorization is revoked, without leaking a new snapshot', async () => {
    const auth = authorization();
    const received = jest.fn();
    const subscription = create().stream(auth).subscribe(received);
    await flush();
    auth.authorize.mockRejectedValue(new Error('revoked') as never);
    changes.next({ key: 'authorization' });
    await flush();
    expect(subscription.closed).toBe(true);
    expect(received).toHaveBeenCalledTimes(1);
  });
});
