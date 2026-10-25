import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ScopeService } from '../rbac/services/scope.service';
import { RealtimeService } from './realtime.service';
import { ClockService } from '../clock/clock.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RealtimeRepository } from './realtime.repository';
import { safeErrorName } from '../logging/safe-error';
import { WsAuthService } from './ws-auth.service';

interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
  trackingToken?: string;
  trackingQueueId?: string;
  registrationId?: string;
}

const UUID_PATTERN =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';

@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly realtimeRepository: RealtimeRepository,
    private readonly scopeService: ScopeService,
    private readonly realtimeService: RealtimeService,
    private readonly clockService: ClockService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
    this.logger.log('Realtime WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const auth = client.handshake.auth || {};
      const headers = client.handshake.headers || {};
      const token =
        auth.token ||
        (headers.authorization?.startsWith('Bearer ')
          ? headers.authorization.slice(7)
          : null);
      const trackingToken =
        auth.registrationToken || headers['x-registration-token'];

      if (token) {
        client.user = await this.wsAuthService.authenticate(token);
        this.logger.debug(
          `Authenticated user connected via WS userId=${client.user.userId}`,
        );
        return;
      }

      if (trackingToken) {
        // Resolve registration by token (§7.9, §4.14)
        const reg =
          await this.realtimeRepository.findRegistrationByTrackingToken(
            String(trackingToken),
          );

        if (reg) {
          const validUntil = this.clockService.parse(
            reg.registration_tracking_token_valid_until,
          );
          if (validUntil > this.clockService.now() && reg.is_active) {
            client.trackingToken = String(trackingToken);
            client.trackingQueueId = String(reg.queue_id);
            client.registrationId = String(reg.registration_id);
            this.logger.debug(
              `Tracking token connected for registration ${client.registrationId}`,
            );
            return;
          }
        }
      }

      // Anonymous connection is strictly refused (§7.9)
      this.logger.warn(`Unauthorized WS connection attempt from ${client.id}`);
      client.disconnect(true);
    } catch (err: unknown) {
      this.logger.warn(`WS connection rejected type=${safeErrorName(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  // Subscribe / Join Room (§7.9)
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    const room = data?.room;
    if (!room) return { error: 'Room required' };

    const displayMatch = room.match(
      new RegExp(`^queue:(${UUID_PATTERN}):display$`),
    );
    const trackingMatch = room.match(
      new RegExp(`^queue:(${UUID_PATTERN}):tracking$`),
    );

    if (displayMatch) {
      if (!client.user) return { error: 'Authentication required' };
      const queueId = displayMatch[1];

      try {
        await this.scopeService.checkQueueAccess(client.user, queueId);
        client.join(room);
        return { subscribed: true, room };
      } catch {
        return { error: 'Queue out of scope' };
      }
    }

    if (trackingMatch) {
      const queueId = trackingMatch[1];
      if (!client.trackingToken || client.trackingQueueId !== queueId) {
        return { error: 'Access denied' };
      }
      client.join(room);
      return { subscribed: true, room };
    }

    return { error: 'Unknown room' };
  }

  // Ping queue session to update last_seen_at (§4.6, §7.9)
  @SubscribeMessage('ping_session')
  async handlePingSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { queueId: string; sessionId: string },
  ) {
    if (!client.user || !data?.queueId || !data?.sessionId) {
      return { acknowledged: false };
    }

    try {
      await this.realtimeRepository.touchQueueSession(
        data.sessionId,
        data.queueId,
        client.user.userId,
        this.clockService.now(),
      );
      return {
        acknowledged: true,
        timestamp: this.clockService.now().toISOString(),
      };
    } catch (err: unknown) {
      this.logger.error(
        `WS session heartbeat failed type=${safeErrorName(err)}`,
      );
      return { acknowledged: false };
    }
  }
}
