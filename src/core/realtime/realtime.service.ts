import { DatabaseEventsService } from '../database/database-events.service';
import { readOnChange } from './read-on-change';
import { runtimeMetrics } from '../observability/runtime-metrics';
import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  filter,
  ignoreElements,
  from,
  interval,
  map,
  merge,
  takeUntil,
  timer,
  shareReplay,
  finalize,
  of,
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

export interface StreamAuthorization {
  authorize: () => Promise<void>;
  expiresAt: Date;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly topics = new Map<
    string,
    Observable<RealtimeTopicStateRow | null>
  >();

  constructor(
    private readonly clockService: ClockService,
    private readonly repository: RealtimeRepository,
    private readonly databaseEvents: DatabaseEventsService,
  ) {}

  async streamDisplay(
    queueId: string,
    lastEventId?: string,
    authorization?: StreamAuthorization,
  ): Promise<Observable<MessageEvent>> {
    return this.stream(
      queueId,
      QUEUE_DISPLAY_CHANGED,
      lastEventId,
      authorization,
    );
  }

  async streamTracking(
    queueId: string,
    lastEventId?: string,
    authorization?: StreamAuthorization,
  ): Promise<Observable<MessageEvent>> {
    return this.stream(
      queueId,
      QUEUE_POSITION_CHANGED,
      lastEventId,
      authorization,
    );
  }

  private async stream(
    queueId: string,
    eventName: RealtimeOutboxRow['event_type'],
    lastEventId?: string,
    authorization?: StreamAuthorization,
  ): Promise<Observable<MessageEvent>> {
    const initialState = await this.repository.findTopicState(
      queueId,
      eventName,
    );
    let currentEventId = lastEventId ?? initialState?.event_id;

    const authorize = async () => {
      if (!authorization) return;
      if (authorization.expiresAt <= this.clockService.now()) {
        throw new Error('Stream authorization expired');
      }
      await authorization.authorize();
    };
    const events = defer(() => this.sharedTopic(queueId, eventName)).pipe(
      concatMap((state) =>
        from(authorize()).pipe(
          concatMap(() => {
            if (!state || state.event_id === currentEventId) return EMPTY;
            currentEventId = state.event_id;
            return of(this.toMessageEvent(state));
          }),
        ),
      ),
    );
    const heartbeat = interval(15000).pipe(
      filter(() => this.databaseEvents.connected),
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clockService.now().toISOString() },
      })),
    );
    const stream = defer(() => {
      runtimeMetrics.add('sse_connections_active');
      const security = readOnChange(
        this.databaseEvents.changes(['authorization']),
        authorize,
      ).pipe(ignoreElements());
      return merge(events, heartbeat, security).pipe(
        finalize(() => {
          runtimeMetrics.add('sse_connections_active', -1);
        }),
      );
    }).pipe(
      catchError((error: unknown) => {
        // Headers have already been sent: close the stream instead of invoking
        // the HTTP exception filter or continuing with stale authorization.
        this.logger.debug(
          `Realtime authorization ended type=${safeErrorName(error)}`,
        );
        return EMPTY;
      }),
    );
    return authorization
      ? stream.pipe(
          takeUntil(
            defer(() =>
              timer(
                Math.max(
                  0,
                  Math.min(
                    2_147_483_647,
                    authorization.expiresAt.getTime() -
                      this.clockService.now().getTime(),
                  ),
                ),
              ),
            ),
          ),
        )
      : stream;
  }

  private sharedTopic(
    queueId: string,
    eventName: RealtimeOutboxRow['event_type'],
  ): Observable<RealtimeTopicStateRow | null> {
    const key = queueId + ':' + eventName;
    const existing = this.topics.get(key);
    if (existing) return existing;
    const topic = readOnChange(
      this.databaseEvents.changes(['queue:' + key]),
      async () => {
        runtimeMetrics.add('sse_topic_reads_total');
        const started = performance.now();
        try {
          return await this.repository.findTopicState(queueId, eventName);
        } finally {
          runtimeMetrics.observe('sse_topic_read', performance.now() - started);
        }
      },
    ).pipe(
      finalize(() => this.topics.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.topics.set(key, topic);
    return topic;
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
