import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Server } from 'socket.io';
import type Redis from 'ioredis';
import { ClockService } from '../clock/clock.service';

const QUEUE_EVENTS_CHANNEL = 'dori:queue-events';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(
    private readonly clockService: ClockService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis?: Redis | null,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  async emitQueueDisplayChanged(
    queueId: string,
    reason:
      | 'registration_created'
      | 'registration_called'
      | 'registration_served'
      | 'registration_no_show',
  ): Promise<void> {
    const payload = {
      queueId,
      reason,
      timestamp: this.clockService.now().toISOString(),
    };
    if (this.server) {
      this.server
        .to(`queue:${queueId}:display`)
        .emit('queue_display_changed', payload);
      return;
    }
    await this.publish({
      room: `queue:${queueId}:display`,
      event: 'queue_display_changed',
      payload,
    });
  }

  async emitQueuePositionChanged(queueId: string): Promise<void> {
    const payload = {
      queueId,
      timestamp: this.clockService.now().toISOString(),
    };
    if (this.server) {
      this.server
        .to(`queue:${queueId}:tracking`)
        .emit('queue_position_changed', payload);
      return;
    }
    await this.publish({
      room: `queue:${queueId}:tracking`,
      event: 'queue_position_changed',
      payload,
    });
  }

  private async publish(event: Record<string, unknown>): Promise<void> {
    if (!this.redis) {
      this.logger.warn(
        'Queue event not published because Redis is unavailable',
      );
      return;
    }
    await this.waitUntilRedisReady();
    await this.redis.publish(QUEUE_EVENTS_CHANNEL, JSON.stringify(event));
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
