import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import {
  EMPTY,
  Observable,
  catchError,
  exhaustMap,
  from,
  interval,
  map,
  merge,
} from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { safeErrorName } from '../logging/safe-error';
import {
  RealtimeOutboxRow,
  RealtimeRepository,
  RealtimeTopicStateRow,
} from './realtime.repository';

export const QUEUE_DISPLAY_CHANGED = 'queue_display_changed';
export const QUEUE_POSITION_CHANGED = 'queue_position_changed';
const TOPIC_POLL_INTERVAL_MS = 2000;

export type QueueDisplayChangeReason =
  | 'registration_created'
  | 'appointment_checked_in'
  | 'registration_called'
  | 'registration_recalled'
  | 'registration_served'
  | 'registration_no_show';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly clockService: ClockService,
    private readonly repository: RealtimeRepository,
  ) {}

  async streamDisplay(
    queueId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    return this.stream(queueId, QUEUE_DISPLAY_CHANGED, lastEventId);
  }

  async streamTracking(
    queueId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    return this.stream(queueId, QUEUE_POSITION_CHANGED, lastEventId);
  }

  private async stream(
    queueId: string,
    eventName: RealtimeOutboxRow['event_type'],
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const initialState = await this.repository.findTopicState(
      queueId,
      eventName,
    );
    let currentEventId = lastEventId ?? initialState?.event_id;

    const events = interval(TOPIC_POLL_INTERVAL_MS).pipe(
      exhaustMap(() =>
        from(this.repository.findTopicState(queueId, eventName)).pipe(
          exhaustMap((state) => {
            if (!state || state.event_id === currentEventId) return EMPTY;
            currentEventId = state.event_id;
            return from([this.toMessageEvent(state)]);
          }),
          catchError((error: unknown) => {
            this.logger.warn(
              `Realtime topic polling failed type=${safeErrorName(error)}`,
            );
            return EMPTY;
          }),
        ),
      ),
    );
    const heartbeat = interval(15000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clockService.now().toISOString() },
      })),
    );
    return merge(events, heartbeat);
  }

  private toMessageEvent(event: RealtimeTopicStateRow): MessageEvent {
    return {
      id: event.event_id,
      type: event.event_type,
      retry: 3000,
      data: event.payload,
    };
  }
}
