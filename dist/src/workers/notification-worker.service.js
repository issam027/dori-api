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
var NotificationWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationWorkerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../core/database/prisma.service");
const clock_service_1 = require("../core/clock/clock.service");
let NotificationWorkerService = NotificationWorkerService_1 = class NotificationWorkerService {
    prisma;
    clockService;
    logger = new common_1.Logger(NotificationWorkerService_1.name);
    constructor(prisma, clockService) {
        this.prisma = prisma;
        this.clockService = clockService;
    }
    async processPendingNotifications() {
        const pendingNotifications = await this.prisma.notification.findMany({
            where: {
                notificationStatus: 'pending',
            },
            take: 20,
        });
        for (const notif of pendingNotifications) {
            try {
                const now = this.clockService.now();
                this.logger.log(`Envoi notification [${notif.channel.toUpperCase()}] à ${notif.recipient}: ${notif.notificationContent}`);
                const providerMessageId = `prov_${Date.now()}_${notif.notificationId}`;
                await this.prisma.notification.update({
                    where: { notificationId: notif.notificationId },
                    data: {
                        notificationStatus: 'sent',
                        sentAt: now,
                        providerMessageId,
                        attemptCount: { increment: 1 },
                    },
                });
            }
            catch (err) {
                this.logger.error(`Échec envoi notification id=${notif.notificationId}:`, err);
                await this.prisma.notification.update({
                    where: { notificationId: notif.notificationId },
                    data: {
                        attemptCount: { increment: 1 },
                        failureReason: err?.message || 'Erreur inconnue',
                        notificationStatus: notif.attemptCount >= 3 ? 'failed' : 'pending',
                    },
                });
            }
        }
    }
};
exports.NotificationWorkerService = NotificationWorkerService;
exports.NotificationWorkerService = NotificationWorkerService = NotificationWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clock_service_1.ClockService])
], NotificationWorkerService);
//# sourceMappingURL=notification-worker.service.js.map