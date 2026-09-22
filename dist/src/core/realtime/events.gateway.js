"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EventsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../database/prisma.service");
const clock_service_1 = require("../clock/clock.service");
let EventsGateway = EventsGateway_1 = class EventsGateway {
    jwtService;
    prisma;
    clockService;
    server;
    logger = new common_1.Logger(EventsGateway_1.name);
    constructor(jwtService, prisma, clockService) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.clockService = clockService;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
            const trackingToken = client.handshake.auth?.trackingToken || client.handshake.headers?.['x-registration-token'];
            if (token) {
                const payload = this.jwtService.verify(token, {
                    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_dori_v3_change_in_production_min32chars',
                });
                client.data.user = payload;
                this.logger.log(`Client WS authentifié: user=${payload.sub}`);
            }
            else if (trackingToken) {
                client.data.trackingToken = trackingToken;
                client.join(`registration:${trackingToken}`);
                this.logger.log(`Client WS suivi public: token=${trackingToken}`);
            }
        }
        catch (e) {
            this.logger.debug(`Connexion WS sans authentification valide`);
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client WS déconnecté: id=${client.id}`);
    }
    async handleJoinQueueOps(client, data) {
        if (!client.data.user) {
            client.emit('error', { message: 'Authentification requise' });
            return;
        }
        const room = `queue:${data.queueId}:ops`;
        client.join(room);
        return { joined: room };
    }
    async handleJoinQueueDisplay(client, data) {
        const room = `queue:${data.queueId}:display`;
        client.join(room);
        return { joined: room };
    }
    async handlePingSession(client, data) {
        if (!client.data.user || !data.sessionId)
            return;
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
    emitQueueOpsUpdate(queueId, event, payload) {
        this.server.to(`queue:${queueId}:ops`).emit(event, payload);
    }
    emitQueueDisplayUpdate(queueId, currentCalls, nextTickets) {
        this.server.to(`queue:${queueId}:display`).emit('display:update', {
            currentCalls,
            nextTickets,
        });
    }
    emitPositionUpdate(trackingToken, position, estimatedMinutes) {
        this.server.to(`registration:${trackingToken}`).emit('position:update', {
            position,
            estimatedMinutes,
        });
    }
    emitTranslationsInvalidated(category, version) {
        this.server.emit('system:translations:invalidated', { category, version });
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:queue:ops'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handleJoinQueueOps", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:queue:display'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handleJoinQueueDisplay", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping:session'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handlePingSession", null);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/realtime',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService,
        clock_service_1.ClockService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map