import {
  Inject,
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { Observable, Subject, filter, map } from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { safeErrorName } from '../logging/safe-error';
import { REDIS_CLIENT } from '../redis/redis.module';

export const QUEUE_EVENTS_CHANNEL = 'dori:queue-events';
export const QUEUE_DISPLAY_CHANGED = 'queue_display_changed';
export const QUEUE_POSITION_CHANGED = 'queue_position_changed';

export type QueueDisplayChangeReason =
  | 'registration_created'
  | 'appointment_checked_in'
  | 'registration_called'
  | 'registration_served'
  | 'registration_no_show';

interface QueueEvent {
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
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  async emitQueueDisplayChanged(
    queueId: string,
    reason: QueueDisplayChangeReason,
  ): Promise<void> {
    await this.publish({
      event: QUEUE_DISPLAY_CHANGED,
      queueId,
      payload: {
        queueId,
        reason,
        timestamp: this.clockService.now().toISOString(),
      },
    });
  }

  async emitQueuePositionChanged(queueId: string): Promise<void> {
    await this.publish({
      event: QUEUE_POSITION_CHANGED,
      queueId,
      payload: {
        queueId,
        timestamp: this.clockService.now().toISOString(),
      },
    });
  }

  async streamDisplay(queueId: string): Promise<Observable<MessageEvent>> {
    await this.ensureRedisSubscription();
    return this.stream(queueId, QUEUE_DISPLAY_CHANGED);
  }

  async streamTracking(queueId: string): Promise<Observable<MessageEvent>> {
    await this.ensureRedisSubscription();
    return this.stream(queueId, QUEUE_POSITION_CHANGED);
  }

  async onModuleDestroy(): Promise<void> {
    this.events.complete();
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  private stream(
    queueId: string,
    eventName: QueueEvent['event'],
  ): Observable<MessageEvent> {
    return this.events.pipe(
      filter((event) => event.queueId === queueId && event.event === eventName),
      map((event) => ({ type: event.event, data: event.payload })),
    );
  }

  private async publish(event: QueueEvent): Promise<void> {
    if (!this.redis) {
      this.events.next(event);
      this.logger.warn(
        'Queue event delivered locally because Redis is unavailable',
      );
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
    this.subscriber = subscriber;
    subscriber.on('error', (error: Error) => {
      this.logger.warn(
        `Redis queue event subscription error type=${safeErrorName(error)}`,
      );
    });
    subscriber.on('message', (channel, message) => {
      if (channel !== QUEUE_EVENTS_CHANNEL) return;
      const event = this.parseEvent(message);
      if (event) this.events.next(event);
    });
    await this.waitUntilReady(subscriber);
    await subscriber.subscribe(QUEUE_EVENTS_CHANNEL);
    this.logger.log(`Subscribed to Redis channel ${QUEUE_EVENTS_CHANNEL}`);
  }

  private parseEvent(message: string): QueueEvent | null {
    try {
      const event = JSON.parse(message) as Partial<QueueEvent>;
      if (
        typeof event.queueId !== 'string' ||
        (event.event !== QUEUE_DISPLAY_CHANGED &&
          event.event !== QUEUE_POSITION_CHANGED) ||
        !event.payload ||
        typeof event.payload !== 'object'
      ) {
        return null;
      }
      return event as QueueEvent;
    } catch {
      this.logger.warn('Ignored malformed Redis queue event');
      return null;
    }
  }

  private async waitUntilReady(client: Redis): Promise<void> {
    if (client.status === 'ready') return;
    if (client.status === 'wait') {
      await client.connect();
      return;
    }
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
