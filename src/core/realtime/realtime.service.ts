import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ClockService } from '../clock/clock.service';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(private readonly clockService: ClockService) {}

  setServer(server: Server) {
    this.server = server;
  }

  // queue:{queueId}:ops - full details except notes (§7.9)
  emitQueueOps(queueId: number, event: string, payload: Record<string, any>) {
    if (!this.server) return;
    this.server.to(`queue:${queueId}:ops`).emit(event, payload);
  }

  // queue:{queueId}:display - ONLY ticket numbers and thread numbers, NO names/phone/notes (§7.9)
  emitQueueDisplay(
    queueId: number,
    event: string,
    payload: {
      ticketNumber?: string;
      threadNumber?: number;
      calledTickets?: string[];
      waitingCount?: number;
      [key: string]: any;
    },
  ) {
    if (!this.server) return;
    // Sanitize payload strictly to strip any personal info
    const safePayload = {
      event,
      ticketNumber: payload.ticketNumber,
      threadNumber: payload.threadNumber,
      calledTickets: payload.calledTickets,
      waitingCount: payload.waitingCount,
      timestamp: this.clockService.now().toISOString(),
    };
    this.server.to(`queue:${queueId}:display`).emit(event, safePayload);
  }

  // registration:{registrationTrackingToken} - position, estimatedWaitMinutes, status only
  emitRegistrationUpdate(
    trackingToken: string,
    payload: {
      ticketNumber: string;
      status: string;
      position?: number;
      estimatedWaitMinutes?: number;
    },
  ) {
    if (!this.server) return;
    this.server
      .to(`registration:${trackingToken}`)
      .emit('position_update', payload);
  }

  // system:translations - cache invalidation
  emitTranslationInvalidation(category: string, version: number) {
    if (!this.server) return;
    this.server
      .to('system:translations')
      .emit('translation_cache_invalidated', {
        category,
        version,
        timestamp: this.clockService.now().toISOString(),
      });
  }
}
