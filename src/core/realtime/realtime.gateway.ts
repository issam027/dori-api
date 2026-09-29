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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ScopeService } from '../rbac/services/scope.service';
import { RealtimeService } from './realtime.service';
import {
  JwtPayload,
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
  trackingToken?: string;
  registrationId?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly realtimeService: RealtimeService,
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
        const secret =
          this.configService.get<string>('jwt.secret') ||
          'change-me-in-production';
        const payload: JwtPayload = this.jwtService.verify(token, { secret });

        // SEC-05 : Vérification de session active et de compte non désactivé
        if (payload.sid) {
          // Token post-SEC-02 : vérifier la session spécifique
          const sessions = await this.dataSource.query(
            `SELECT s.session_id, u.is_active
             FROM dori_user_session s
             JOIN dori_user u ON u.user_id = s.user_id
             WHERE s.session_id = $1
               AND s.revoked_at IS NULL
               AND s.expires_at > NOW()
               AND u.deleted_at IS NULL`,
            [payload.sid],
          );
          if (!sessions || sessions.length === 0 || !sessions[0].is_active) {
            this.logger.warn(
              `WS rejected: session revoked or account disabled (sid=${payload.sid})`,
            );
            client.disconnect(true);
            return;
          }
        } else {
          // Fallback : tokens émis avant SEC-02 (sans sid) — vérifier au moins is_active
          const users = await this.dataSource.query(
            `SELECT is_active FROM dori_user
             WHERE user_id = $1 AND deleted_at IS NULL`,
            [payload.sub],
          );
          if (!users || users.length === 0 || !users[0].is_active) {
            this.logger.warn(
              `WS rejected: account disabled or not found (userId=${payload.sub})`,
            );
            client.disconnect(true);
            return;
          }
        }

        client.user = {
          userId: Number(payload.sub),
          username: payload.username,
          userType: payload.userType,
          roles: payload.roles,
          permissions: payload.permissions,
          sessionId: payload.sid,
        };
        this.logger.debug(
          `User ${client.user.username} (id: ${client.user.userId}) connected via WS`,
        );
        return;
      }

      if (trackingToken) {
        // Resolve registration by token (§7.9, §4.14)
        const rows = await this.dataSource.query(
          `SELECT customer_id, registration_tracking_token_valid_until, is_active
           FROM dori_customer
           WHERE registration_tracking_token = $1`,
          [trackingToken],
        );

        if (rows && rows.length > 0) {
          const reg = rows[0];
          const validUntil = new Date(
            reg.registration_tracking_token_valid_until,
          );
          if (validUntil > new Date() && reg.is_active) {
            client.trackingToken = String(trackingToken);
            client.registrationId = Number(reg.customer_id);
            // Automatically join own registration room
            client.join(`registration:${trackingToken}`);
            this.logger.debug(
              `Tracking token connected for customer ${client.registrationId}`,
            );
            return;
          }
        }
      }

      // Anonymous connection is strictly refused (§7.9)
      this.logger.warn(`Unauthorized WS connection attempt from ${client.id}`);
      client.disconnect(true);
    } catch (err: any) {
      this.logger.warn(`WS connection auth error: ${err.message}`);
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

    // 1. Translations room
    if (room === 'system:translations') {
      if (!client.user) return { error: 'Authentication required' };
      client.join(room);
      return { subscribed: true, room };
    }

    // 2. Public registration tracking room
    if (room.startsWith('registration:')) {
      const token = room.replace('registration:', '');
      if (client.trackingToken === token) {
        client.join(room);
        return { subscribed: true, room };
      }
      return { error: 'Access denied' };
    }

    // 3. Queue channels: queue:{queueId}:ops and queue:{queueId}:display
    const opsMatch = room.match(/^queue:(\d+):ops$/);
    const displayMatch = room.match(/^queue:(\d+):display$/);

    if (opsMatch) {
      if (!client.user) return { error: 'Authentication required' };
      const queueId = parseInt(opsMatch[1], 10);

      // Check permission and scope (§7.9)
      const hasPermission =
        client.user.roles?.includes('root') ||
        client.user.permissions?.includes('queue_view');

      if (!hasPermission) return { error: 'Missing permission queue_view' };

      try {
        await this.scopeService.checkQueueAccess(client.user, queueId);
        client.join(room);
        return { subscribed: true, room };
      } catch {
        return { error: 'Queue out of scope' };
      }
    }

    if (displayMatch) {
      if (!client.user) return { error: 'Authentication required' };
      const queueId = parseInt(displayMatch[1], 10);

      try {
        await this.scopeService.checkQueueAccess(client.user, queueId);
        client.join(room);
        return { subscribed: true, room };
      } catch {
        return { error: 'Queue out of scope' };
      }
    }

    return { error: 'Unknown room' };
  }

  // Ping queue session to update last_seen_at (§4.6, §7.9)
  @SubscribeMessage('ping_session')
  async handlePingSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { queueId: number; sessionId: number },
  ) {
    if (!client.user || !data?.queueId || !data?.sessionId) {
      return { acknowledged: false };
    }

    try {
      await this.dataSource.query(
        `UPDATE dori_queue_session
         SET last_seen_at = CURRENT_TIMESTAMP
         WHERE session_id = $1 AND queue_id = $2 AND user_id = $3 AND disconnected_at IS NULL`,
        [data.sessionId, data.queueId, client.user.userId],
      );
      return { acknowledged: true, timestamp: new Date().toISOString() };
    } catch (err: any) {
      this.logger.error(`Error updating session last_seen_at: ${err.message}`);
      return { acknowledged: false };
    }
  }
}
