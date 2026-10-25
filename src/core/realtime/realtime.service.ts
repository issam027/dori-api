import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Server } from 'socket.io';
import type Redis from 'ioredis';
import { ClockService } from '../clock/clock.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  QUEUE_EVENTS_CHANNEL,
  QueueDisplayChangeReason,
  QueueRealtimeEvent,
} from './queue-realtime-event';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(
    private readonly clockService: ClockService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  async emitQueueDisplayChanged(
    queueId: string,
    reason: QueueDisplayChangeReason,
  ): Promise<void> {
    await this.dispatch({
      room: `queue:${queueId}:display`,
      event: 'queue_display_changed',
      payload: {
        queueId,
        reason,
        timestamp: this.clockService.now().toISOString(),
      },
    });
  }

  async emitQueuePositionChanged(queueId: string): Promise<void> {
    await this.dispatch({
      room: `queue:${queueId}:tracking`,
      event: 'queue_position_changed',
      payload: {
        queueId,
        timestamp: this.clockService.now().toISOString(),
      },
    });
  }

  private async dispatch(realtimeEvent: QueueRealtimeEvent): Promise<void> {
    if (this.server) {
      this.server
        .to(realtimeEvent.room)
        .emit(realtimeEvent.event, realtimeEvent.payload);
      return;
    }
    if (!this.redis) {
      this.logger.warn(
        'Queue realtime event skipped because Redis is unavailable',
      );
      return;
    }
    await this.waitUntilRedisReady();
    await this.redis.publish(
      QUEUE_EVENTS_CHANNEL,
      JSON.stringify(realtimeEvent),
    );
  }

  private async waitUntilRedisReady(): Promise<void> {
    if (!this.redis || this.redis.status === 'ready') return;
    if (this.redis.status === 'wait') {
      await this.redis.connect();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.redis?.off('ready', onReady);
        this.redis?.off('error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      this.redis?.once('ready', onReady);
      this.redis?.once('error', onError);
    });
  }
}
