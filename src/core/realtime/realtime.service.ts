import {
  Inject,
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';
import {
  Observable,
  Subject,
  concat,
  filter,
  from,
  interval,
  map,
  merge,
  mergeMap,
} from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { safeErrorName } from '../logging/safe-error';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RealtimeOutboxRow, RealtimeRepository } from './realtime.repository';

export const QUEUE_EVENTS_CHANNEL = 'dori:queue-events';
export const QUEUE_DISPLAY_CHANGED = 'queue_display_changed';
export const QUEUE_POSITION_CHANGED = 'queue_position_changed';
const OUTBOX_RETENTION_MS = 24 * 60 * 60 * 1000;
export type QueueDisplayChangeReason =
  | 'registration_created'
  | 'appointment_checked_in'
  | 'registration_called'
  | 'registration_served'
  | 'registration_no_show';

interface QueueEvent {
  id: string;
  event: typeof QUEUE_DISPLAY_CHANGED | typeof QUEUE_POSITION_CHANGED;
  queueId: string;
  payload: Record<string, unknown>;
}
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly events = new Subject<QueueEvent>();
  private subscriber: Redis | null = null;
  private subscriptionPromise: Promise<void> | null = null;

  constructor(
    private readonly clockService: ClockService,
    private readonly repository: RealtimeRepository,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  async dispatchPending(cleanupPublished = false): Promise<void> {
    try {
      const now = this.clockService.now();
      for (const row of await this.repository.claimPending(now)) {
        try {
          await this.publish(this.fromOutbox(row));
          await this.repository.markPublished(
            row.event_id,
            this.clockService.now(),
          );
        } catch (error: unknown) {
          await this.repository
            .markFailed(row.event_id, this.clockService.now())
            .catch(() => undefined);
          this.logger.warn(
            `Realtime outbox publish failed type=${safeErrorName(error)}`,
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
    await this.ensureRedisSubscription();
    return this.stream(queueId, QUEUE_DISPLAY_CHANGED, lastEventId);
  }

  async streamTracking(
    queueId: string,
    lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    await this.ensureRedisSubscription();
    return this.stream(queueId, QUEUE_POSITION_CHANGED, lastEventId);
  }

  async onModuleDestroy(): Promise<void> {
    this.events.complete();
    if (this.subscriber) await this.subscriber.quit();
    this.subscriber = null;
  }

  private stream(
    queueId: string,
    eventName: QueueEvent['event'],
    lastEventId?: string,
  ): Observable<MessageEvent> {
    const live = this.events.pipe(
      filter((event) => event.queueId === queueId && event.event === eventName),
      map((event) => this.toMessageEvent(event)),
    );
    const heartbeat = interval(15000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clockService.now().toISOString() },
      })),
    );
    if (!lastEventId) return merge(live, heartbeat);
    const replay = from(
      this.repository.findReplay(lastEventId, queueId, eventName),
    ).pipe(
      mergeMap((rows) => from(rows)),
      map((row) => this.toMessageEvent(this.fromOutbox(row))),
    );
    return concat(replay, merge(live, heartbeat));
  }

  private async publish(event: QueueEvent): Promise<void> {
    if (!this.redis) {
      this.events.next(event);
      return;
    }
    await this.waitUntilReady(this.redis);
    await this.redis.publish(QUEUE_EVENTS_CHANNEL, JSON.stringify(event));
  }

  private async ensureRedisSubscription(): Promise<void> {
    if (!this.redis) return;
    this.subscriptionPromise ??= this.subscribeToRedis().catch((error) => {
      this.subscriptionPromise = null;
      throw error;
    });
    await this.subscriptionPromise;
  }

  private async subscribeToRedis(): Promise<void> {
    const subscriber = this.redis?.duplicate();
    if (!subscriber) return;
    try {
      subscriber.on('error', (error: Error) =>
        this.logger.warn(
          `Redis queue event subscription error type=${safeErrorName(error)}`,
        ),
      );
      subscriber.on('message', (channel, message) => {
        if (channel !== QUEUE_EVENTS_CHANNEL) return;
        const event = this.parseEvent(message);
        if (event) this.events.next(event);
      });
      await this.waitUntilReady(subscriber);
      await subscriber.subscribe(QUEUE_EVENTS_CHANNEL);
      this.subscriber = subscriber;
    } catch (error) {
      subscriber.disconnect();
      throw error;
    }
  }

  private fromOutbox(row: RealtimeOutboxRow): QueueEvent {
    return {
      id: row.event_id,
      event: row.event_type,
      queueId: row.queue_id,
      payload: row.payload,
    };
  }

  private toMessageEvent(event: QueueEvent): MessageEvent {
    return {
      id: event.id,
      type: event.event,
      retry: 3000,
      data: event.payload,
    };
  }

  private parseEvent(message: string): QueueEvent | null {
    try {
      const event = JSON.parse(message) as Partial<QueueEvent>;
      if (
        typeof event.id !== 'string' ||
        typeof event.queueId !== 'string' ||
        (event.event !== QUEUE_DISPLAY_CHANGED &&
          event.event !== QUEUE_POSITION_CHANGED) ||
        !event.payload ||
        typeof event.payload !== 'object'
      )
        return null;
      return event as QueueEvent;
    } catch {
      return null;
    }
  }

  private async waitUntilReady(client: Redis): Promise<void> {
    if (client.status === 'ready') return;
    if (client.status === 'wait') return client.connect();
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        client.off('ready', onReady);
        client.off('error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      client.once('ready', onReady);
      client.once('error', onError);
    });
  }
}
