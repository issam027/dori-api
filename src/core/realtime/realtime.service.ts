import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { ClockService } from '../clock/clock.service';

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  constructor(private readonly clockService: ClockService) {}

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
    if (!this.server) return;
    this.server.to(`queue:${queueId}:display`).emit('queue_display_changed', {
      queueId,
      reason,
      timestamp: this.clockService.now().toISOString(),
    });
  }

  async emitQueuePositionChanged(queueId: string): Promise<void> {
    if (!this.server) return;
    this.server.to(`queue:${queueId}:tracking`).emit('queue_position_changed', {
      queueId,
      timestamp: this.clockService.now().toISOString(),
    });
  }
}
