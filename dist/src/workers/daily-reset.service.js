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
var DailyResetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyResetService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../core/database/prisma.service");
const clock_service_1 = require("../core/clock/clock.service");
const queue_config_helper_1 = require("../modules/queues/queue-config.helper");
let DailyResetService = DailyResetService_1 = class DailyResetService {
    prisma;
    clockService;
    logger = new common_1.Logger(DailyResetService_1.name);
    constructor(prisma, clockService) {
        this.prisma = prisma;
        this.clockService = clockService;
    }
    async resetQueue(queueId) {
        const queue = await this.prisma.queue.findUnique({
            where: { queueId },
            include: { site: true },
        });
        if (!queue)
            return;
        const config = (0, queue_config_helper_1.resolveQueueConfig)(queue, queue.site);
        const now = this.clockService.now();
        const siteTimezone = queue.site.timezone;
        const currentBusinessDateStr = this.clockService.getBusinessDate(siteTimezone, now);
        const currentBusinessDate = new Date(currentBusinessDateStr);
        this.logger.log(`Exécution de la clôture quotidienne pour la file ${queue.queueCode} (id=${queueId})`);
        await this.prisma.$transaction(async (tx) => {
            await tx.queueSession.updateMany({
                where: {
                    queueId,
                    disconnectedAt: null,
                },
                data: {
                    disconnectedAt: now,
                    closureReason: 'daily_reset',
                },
            });
            const waitingCustomers = await tx.customer.findMany({
                where: {
                    queueId,
                    businessDate: currentBusinessDate,
                    status: 'waiting',
                    isActive: true,
                },
            });
            const carryOver = config.carryOverWaiting.value;
            for (const c of waitingCustomers) {
                const alreadyCarriedOver = c.ticketNumber.startsWith('OLD-') || c.carriedOverFromDate !== null;
                if (!carryOver || alreadyCarriedOver) {
                    await tx.customer.update({
                        where: { customerId: c.customerId },
                        data: {
                            status: 'expired',
                            closedAt: now,
                            isActive: false,
                        },
                    });
                }
                else {
                    const nextDay = new Date(currentBusinessDate.getTime() + 24 * 60 * 60 * 1000);
                    await tx.customer.update({
                        where: { customerId: c.customerId },
                        data: {
                            ticketNumber: `OLD-${c.ticketNumber}`,
                            businessDate: nextDay,
                            carriedOverFromDate: currentBusinessDate,
                        },
                    });
                }
            }
            const resetMode = config.dailyResetMode.value;
            const statusToClose = resetMode === 'close_all' ? ['served', 'no_show', 'expired'] : ['served'];
            await tx.customer.updateMany({
                where: {
                    queueId,
                    businessDate: currentBusinessDate,
                    status: { in: statusToClose },
                    isActive: true,
                },
                data: {
                    isActive: false,
                    deletedAt: now,
                },
            });
            await tx.customer.updateMany({
                where: {
                    queueId,
                    businessDate: currentBusinessDate,
                    entryType: 'appointment',
                    appointmentStatus: 'booked',
                    isActive: true,
                },
                data: {
                    appointmentStatus: 'expired',
                    status: 'expired',
                    closedAt: now,
                    isActive: false,
                },
            });
        });
        this.logger.log(`Clôture quotidienne terminée avec succès pour la file ${queue.queueCode}`);
    }
};
exports.DailyResetService = DailyResetService;
exports.DailyResetService = DailyResetService = DailyResetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clock_service_1.ClockService])
], DailyResetService);
//# sourceMappingURL=daily-reset.service.js.map