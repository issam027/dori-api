import { MessageEvent } from '@nestjs/common';
import { createHash } from 'crypto';
import { ClockService } from '../clock/clock.service';
import { RealtimeRepository } from './realtime.repository';
import { ReplicatedTrackingService } from './replicated-tracking.service';

describe('ReplicatedTrackingService', () => {
  const token = '00000000-0000-4000-8000-000000000001';
  const now = new Date('2026-11-02T10:00:00Z');
  const row = {
    sequence: '1',
    expires_at: '2026-11-03T10:00:00Z',
    observed_at: now,
    deployment_status: 'active',
    source_connectivity: 'online',
    ticket_number: 'A42',
    registration_status: 'waiting',
    position: 3,
    estimated_wait_minutes: 6,
    counter_name: null,
    queue_public_name: 'Accueil',
  };
  const clock = {
    now: () => now,
    parse: (value: string | Date) => new Date(value),
  } as ClockService;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits a language backfill even when a legacy snapshot keeps the same sequence', async () => {
    const read = jest
      .fn()
      .mockResolvedValue({ ...row, language_preference: null });
    const service = new ReplicatedTrackingService(
      { findReplicatedTracking: read } as unknown as RealtimeRepository,
      clock,
    );
    const events: MessageEvent[] = [];
    const subscription = (await service.stream(token)).subscribe((event) =>
      events.push(event),
    );
    read.mockResolvedValue({ ...row, language_preference: 'ar-TN' });
    await jest.advanceTimersByTimeAsync(2000);
    expect(events).toHaveLength(2);
    expect(events[1].data).toEqual(
      expect.objectContaining({ languagePreference: 'ar-TN' }),
    );
    subscription.unsubscribe();
  });

  it('authorizes by hash, emits initial state and new versions, and closes on revocation', async () => {
    const read = jest.fn().mockResolvedValue({ ...row });
    const service = new ReplicatedTrackingService(
      { findReplicatedTracking: read } as unknown as RealtimeRepository,
      clock,
    );
    const events: MessageEvent[] = [];
    let closed = false;
    const stream = await service.stream(token);
    const subscription = stream.subscribe({
      next: (event) => events.push(event),
      complete: () => {
        closed = true;
      },
    });
    expect(read).toHaveBeenCalledWith(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tracking_changed');
    expect(events[0].data).toEqual(
      expect.objectContaining({ position: 3, status: 'waiting' }),
    );
    expect(JSON.stringify(events)).not.toContain(token);
    await jest.advanceTimersByTimeAsync(2000);
    expect(events).toHaveLength(1);
    read.mockResolvedValue({
      ...row,
      sequence: '2',
      registration_status: 'in_progress',
      counter_name: 'Guichet 2',
      position: 0,
    });
    await jest.advanceTimersByTimeAsync(2000);
    expect(events[1].data).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        counterName: 'Guichet 2',
      }),
    );
    read.mockResolvedValue({ ...row, deployment_status: 'revoked' });
    await jest.advanceTimersByTimeAsync(2000);
    expect(closed).toBe(true);
    const calls = read.mock.calls.length;
    await jest.advanceTimersByTimeAsync(16000);
    expect(read).toHaveBeenCalledTimes(calls);
    subscription.unsubscribe();
  });

  it.each([
    null,
    { ...row, expires_at: '2026-11-01T10:00:00Z' },
    { ...row, deployment_status: 'revoked' },
  ])(
    'rejects missing, expired or revoked projections before opening SSE',
    async (value) => {
      const service = new ReplicatedTrackingService(
        {
          findReplicatedTracking: jest.fn().mockResolvedValue(value),
        } as unknown as RealtimeRepository,
        clock,
      );
      await expect(service.stream(token)).rejects.toThrow();
    },
  );

  it('shares polling between subscribers and releases the topic on disconnect', async () => {
    const read = jest.fn().mockResolvedValue(row);
    const service = new ReplicatedTrackingService(
      { findReplicatedTracking: read } as unknown as RealtimeRepository,
      clock,
    );
    const one = (await service.stream(token)).subscribe();
    const two = (await service.stream(token)).subscribe();
    expect(read).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(2000);
    expect(read).toHaveBeenCalledTimes(3);
    one.unsubscribe();
    two.unsubscribe();
    await jest.advanceTimersByTimeAsync(6000);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
