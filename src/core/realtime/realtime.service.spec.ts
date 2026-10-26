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
});
