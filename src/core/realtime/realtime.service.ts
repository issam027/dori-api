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
  mergeMap,
  tap,
  timer,
} from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { safeErrorName } from '../logging/safe-error';
import { RealtimeOutboxRow, RealtimeRepository } from './realtime.repository';

export const QUEUE_DISPLAY_CHANGED = 'queue_display_changed';
export const QUEUE_POSITION_CHANGED = 'queue_position_changed';
const OUTBOX_RETENTION_MS = 24 * 60 * 60 * 1000;
const OUTBOX_POLL_INTERVAL_MS = 2000;
export type QueueDisplayChangeReason =
  | 'registration_created'
  | 'appointment_checked_in'
  | 'registration_called'
  | 'registration_served'
  | 'registration_no_show';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly clockService: ClockService,
    private readonly repository: RealtimeRepository,
  ) {}

  async dispatchPending(cleanupPublished = false): Promise<void> {
    try {
      const now = this.clockService.now();
      for (const row of await this.repository.claimPending(now)) {
        try {
          await this.repository.markPublished(
            row.event_id,
            this.clockService.now(),
          );
        } catch (error: unknown) {
          await this.repository
            .markFailed(row.event_id, this.clockService.now())
            .catch(() => undefined);
          this.logger.warn(
            `Realtime outbox acknowledgement failed type=${safeErrorName(error)}`,
          );
        }
      }
      if (cleanupPublished) {
        await this.repository.deletePublishedBefore(
          new Date(now.getTime() - OUTBOX_RETENTION_MS),
        );
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Realtime outbox dispatch unavailable type=${safeErrorName(error)}`,
      );
    }
  }

  async streamDisplay(
    queueId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    await this.dispatchPending();
    return this.stream(queueId, QUEUE_DISPLAY_CHANGED, lastEventId);
  }

  async streamTracking(
    queueId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    await this.dispatchPending();
    return this.stream(queueId, QUEUE_POSITION_CHANGED, lastEventId);
  }

  private stream(
    queueId: string,
    eventName: RealtimeOutboxRow['event_type'],
    lastEventId?: string,
  ): Observable<MessageEvent> {
    const notBefore = this.clockService.now();
    let cursor = lastEventId;
    const events = timer(0, OUTBOX_POLL_INTERVAL_MS).pipe(
      exhaustMap(() =>
        from(
          this.repository.findEventsAfter(
            queueId,
            eventName,
            cursor,
            notBefore,
          ),
        ).pipe(
          mergeMap((rows) => from(rows)),
          tap((row) => {
            cursor = row.event_id;
          }),
          map((row) => this.toMessageEvent(row)),
          catchError((error: unknown) => {
            this.logger.warn(
              `Realtime outbox polling failed type=${safeErrorName(error)}`,
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

  private toMessageEvent(event: RealtimeOutboxRow): MessageEvent {
    return {
      id: event.event_id,
      type: event.event_type,
      retry: 3000,
      data: event.payload,
    };
  }
}
