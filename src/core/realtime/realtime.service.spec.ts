import { firstValueFrom } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  const now = new Date('2026-10-25T14:00:00.000Z');
  const queueId = '00000000-0000-4000-8000-000000000001';
  const clock = {
    now: jest.fn(() => now),
  } as unknown as ClockService;

  it('streams new display events from the durable outbox', async () => {
    const event = {
      event_id: '00000000-0000-4000-8000-000000000011',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId, reason: 'registration_called' },
    };
    const repository = {
      findEventsAfter: jest.fn().mockResolvedValue([event]),
      claimPending: jest.fn().mockResolvedValue([]),
    };
    const service = new RealtimeService(clock, repository as never);

    const stream = await service.streamDisplay(queueId);

    await expect(firstValueFrom(stream)).resolves.toEqual({
      id: event.event_id,
      type: event.event_type,
      retry: 3000,
      data: event.payload,
    });
    expect(repository.findEventsAfter).toHaveBeenCalledWith(
      queueId,
      'queue_display_changed',
      undefined,
      now,
    );
  });

  it('resumes a tracking stream from Last-Event-ID', async () => {
    const lastEventId = '00000000-0000-4000-8000-000000000010';
    const event = {
      event_id: '00000000-0000-4000-8000-000000000012',
      event_type: 'queue_position_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const repository = {
      findEventsAfter: jest.fn().mockResolvedValue([event]),
      claimPending: jest.fn().mockResolvedValue([]),
    };
    const service = new RealtimeService(clock, repository as never);

    const stream = await service.streamTracking(queueId, lastEventId);

    await expect(firstValueFrom(stream)).resolves.toMatchObject({
      id: event.event_id,
      type: event.event_type,
    });
    expect(repository.findEventsAfter).toHaveBeenCalledWith(
      queueId,
      'queue_position_changed',
      lastEventId,
      now,
    );
  });

  it('marks claimed events as processed without Redis', async () => {
    const event = {
      event_id: '00000000-0000-4000-8000-000000000013',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const repository = {
      claimPending: jest.fn().mockResolvedValue([event]),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
      deletePublishedBefore: jest.fn(),
    };
    const service = new RealtimeService(clock, repository as never);

    await expect(service.dispatchPending()).resolves.toBeUndefined();

    expect(repository.markPublished).toHaveBeenCalledWith(event.event_id, now);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('keeps a failed database acknowledgement pending', async () => {
    const event = {
      event_id: '00000000-0000-4000-8000-000000000014',
      event_type: 'queue_display_changed',
      queue_id: queueId,
      payload: { queueId },
    };
    const repository = {
      claimPending: jest.fn().mockResolvedValue([event]),
      markPublished: jest.fn().mockRejectedValue(new Error('unavailable')),
      markFailed: jest.fn().mockResolvedValue(undefined),
      deletePublishedBefore: jest.fn(),
    };
    const service = new RealtimeService(clock, repository as never);

    await expect(service.dispatchPending()).resolves.toBeUndefined();
    expect(repository.markFailed).toHaveBeenCalledWith(event.event_id, now);
  });

  it('purges published events only during maintenance dispatches', async () => {
    const repository = {
      claimPending: jest.fn().mockResolvedValue([]),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
      deletePublishedBefore: jest.fn(),
    };
    const service = new RealtimeService(clock, repository as never);

    await service.dispatchPending(true);

    expect(repository.deletePublishedBefore).toHaveBeenCalledWith(
      new Date('2026-10-24T14:00:00.000Z'),
    );
  });
});
