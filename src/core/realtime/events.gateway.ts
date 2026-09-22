import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { ClockService } from '../clock/clock.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      const trackingToken = client.handshake.auth?.trackingToken || client.handshake.headers?.['x-registration-token'];

      if (token) {
        const payload: JwtPayload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'super_secret_jwt_key_dori_v3_change_in_production_min32chars',
        });
        client.data.user = payload;
        this.logger.log(`Client WS authentifié: user=${payload.sub}`);
      } else if (trackingToken) {
        client.data.trackingToken = trackingToken;
        client.join(`registration:${trackingToken}`);
        this.logger.log(`Client WS suivi public: token=${trackingToken}`);
      }
    } catch (e) {
      this.logger.debug(`Connexion WS sans authentification valide`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client WS déconnecté: id=${client.id}`);
  }

  /**
   * Abonnement à la salle d'exploitation de la file (§7.9)
   */
  @SubscribeMessage('join:queue:ops')
  async handleJoinQueueOps(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { queueId: number },
  ) {
    if (!client.data.user) {
      client.emit('error', { message: 'Authentification requise' });
      return;
    }
    const room = `queue:${data.queueId}:ops`;
    client.join(room);
    return { joined: room };
  }

  /**
   * Abonnement à la salle d'affichage salle d'attente (§7.9)
   */
  @SubscribeMessage('join:queue:display')
  async handleJoinQueueDisplay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { queueId: number },
  ) {
    const room = `queue:${data.queueId}:display`;
    client.join(room);
    return { joined: room };
  }

  /**
   * Ping applicatif rafraîchissant last_seen_at sur la session de guichet (§4.6, §7.9)
   */
  @SubscribeMessage('ping:session')
  async handlePingSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: number },
  ) {
    if (!client.data.user || !data.sessionId) return;

    await this.prisma.queueSession.updateMany({
      where: {
        sessionId: data.sessionId,
        userId: client.data.user.sub,
        disconnectedAt: null,
      },
      data: {
        lastSeenAt: this.clockService.now(),
      },
    });

    return { pong: true };
  }

  /**
   * Méthodes utilitaires d'émission d'événements
   */
  emitQueueOpsUpdate(queueId: number, event: string, payload: any) {
    this.server.to(`queue:${queueId}:ops`).emit(event, payload);
  }

  emitQueueDisplayUpdate(queueId: number, currentCalls: any[], nextTickets: string[]) {
    // Aucune information personnelle n'est envoyée (§7.9, §8.4)
    this.server.to(`queue:${queueId}:display`).emit('display:update', {
      currentCalls,
      nextTickets,
    });
  }

  emitPositionUpdate(trackingToken: string, position: number, estimatedMinutes: number) {
    this.server.to(`registration:${trackingToken}`).emit('position:update', {
      position,
      estimatedMinutes,
    });
  }

  emitTranslationsInvalidated(category: string, version: number) {
    this.server.emit('system:translations:invalidated', { category, version });
  }
}
