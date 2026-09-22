import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { ClockService } from '../clock/clock.service';
export declare class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly prisma;
    private readonly clockService;
    server: Server;
    private readonly logger;
    constructor(jwtService: JwtService, prisma: PrismaService, clockService: ClockService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinQueueOps(client: Socket, data: {
        queueId: number;
    }): Promise<{
        joined: string;
    } | undefined>;
    handleJoinQueueDisplay(client: Socket, data: {
        queueId: number;
    }): Promise<{
        joined: string;
    }>;
    handlePingSession(client: Socket, data: {
        sessionId: number;
    }): Promise<{
        pong: boolean;
    } | undefined>;
    emitQueueOpsUpdate(queueId: number, event: string, payload: any): void;
    emitQueueDisplayUpdate(queueId: number, currentCalls: any[], nextTickets: string[]): void;
    emitPositionUpdate(trackingToken: string, position: number, estimatedMinutes: number): void;
    emitTranslationsInvalidated(category: string, version: number): void;
}
