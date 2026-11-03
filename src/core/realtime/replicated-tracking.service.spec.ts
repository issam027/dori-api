import { MessageEvent } from '@nestjs/common';
import { createHash } from 'crypto';
import { Subject, filter } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { DatabaseChange } from '../database/database-events.service';
import { ReplicatedTrackingService } from './replicated-tracking.service';

describe('event-driven replicated tracking', () => {
  const token = '00000000-0000-4000-8000-000000000001';
  const hash = createHash('sha256').update(token).digest('hex');
  const now = new Date('2026-11-03T10:00:00Z');
  const row = {
    sequence: '1',
    expires_at: '2026-11-03T11:00:00Z',
    observed_at: now,
    deployment_status: 'active',
    source_connectivity: 'online',
    source_installation_id: 'intra',
    source_last_seen_at: now,
    ticket_number: 'A42',
    registration_status: 'waiting',
    position: 3,
    estimated_wait_minutes: 6,
    counter_name: null,
    queue_public_name: 'Accueil',
    language_preference: null,
  };
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
    const read = jest.fn().mockResolvedValue({ ...row });
    return {
      service: new ReplicatedTrackingService(
        { findReplicatedTracking: read } as never,
        new ClockService(),
        bus as never,
      ),
      read,
      changes,
    };
  }
  it('delivers commits and same-sequence metadata without idle SQL', async () => {
    const { service, read, changes } = setup();
    const events: MessageEvent[] = [];
    const subscription = (await service.stream(token)).subscribe((e) =>
      events.push(e),
    );
    await jest.advanceTimersByTimeAsync(0);
    const calls = read.mock.calls.length;
    await jest.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(calls);
    read.mockResolvedValue({ ...row, language_preference: 'ar-TN' });
    changes.next({ key: 'tracking:' + hash });
    await jest.advanceTimersByTimeAsync(0);
    expect(events.at(-1)?.data).toMatchObject({
      languagePreference: 'ar-TN',
      position: 3,
    });
    expect(JSON.stringify(events)).not.toContain(token);
    subscription.unsubscribe();
  });
  it('uses heartbeat metadata and a local timer for connectivity without SQL', async () => {
    const { service, read, changes } = setup();
    const events: MessageEvent[] = [];
    const subscription = (await service.stream(token)).subscribe((e) =>
      events.push(e),
    );
    await jest.advanceTimersByTimeAsync(0);
    const calls = read.mock.calls.length;
    await jest.advanceTimersByTimeAsync(100_000);
    changes.next({
      key: 'installation:intra',
      seenAt: new Date().toISOString(),
      status: 'active',
    });
    await jest.advanceTimersByTimeAsync(100_000);
    expect(events.filter((e) => e.type === 'tracking_changed')).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(events.at(-1)?.data).toMatchObject({
      sourceConnectivity: 'offline',
    });
    expect(read).toHaveBeenCalledTimes(calls);
    changes.next({
      key: 'installation:intra',
      seenAt: new Date().toISOString(),
      status: 'active',
    });
    expect(events.at(-1)?.data).toMatchObject({ sourceConnectivity: 'online' });
    subscription.unsubscribe();
  });
  it('closes immediately on installation revocation', async () => {
    const { service, changes } = setup();
    const complete = jest.fn();
    (await service.stream(token)).subscribe({ complete });
    await jest.advanceTimersByTimeAsync(0);
    changes.next({ key: 'installation:intra', status: 'revoked' });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('expires exactly on time without SQL', async () => {
    const { service, read } = setup();
    read.mockResolvedValue({
      ...row,
      expires_at: new Date(now.getTime() + 2000),
    });
    const complete = jest.fn();
    (await service.stream(token)).subscribe({ complete });
    await jest.advanceTimersByTimeAsync(0);
    const calls = read.mock.calls.length;
    await jest.advanceTimersByTimeAsync(2000);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(calls);
  });
  it('shares event reads and recovers after reconnection', async () => {
    const { service, read, changes } = setup();
    const first = (await service.stream(token)).subscribe();
    const second = (await service.stream(token)).subscribe();
    await jest.advanceTimersByTimeAsync(0);
    const calls = read.mock.calls.length;
    changes.next({ key: 'recovery' });
    await jest.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(calls + 1);
    first.unsubscribe();
    second.unsubscribe();
    changes.next({ key: 'tracking:' + hash });
    await jest.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(calls + 1);
  });
  it.each([
    null,
    { ...row, deployment_status: 'revoked' },
    { ...row, expires_at: now },
  ])('rejects invalid snapshots before SSE headers', async (value) => {
    const { service, read } = setup();
    read.mockResolvedValue(value);
    await expect(service.stream(token)).rejects.toThrow();
  });
});
