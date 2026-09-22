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
var AppointmentExpiryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentExpiryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../core/database/prisma.service");
const clock_service_1 = require("../core/clock/clock.service");
const queue_config_helper_1 = require("../modules/queues/queue-config.helper");
let AppointmentExpiryService = AppointmentExpiryService_1 = class AppointmentExpiryService {
    prisma;
    clockService;
    logger = new common_1.Logger(AppointmentExpiryService_1.name);
    constructor(prisma, clockService) {
        this.prisma = prisma;
        this.clockService = clockService;
    }
    async expireAppointments() {
        const now = this.clockService.now();
        const pendingAppointments = await this.prisma.customer.findMany({
            where: {
                entryType: 'appointment',
                appointmentStatus: 'booked',
                status: 'waiting',
                isActive: true,
            },
            include: {
                queue: {
                    include: { site: true },
                },
            },
        });
        let expiredCount = 0;
        for (const appt of pendingAppointments) {
            if (!appt.scheduledTime)
                continue;
            const config = (0, queue_config_helper_1.resolveQueueConfig)(appt.queue, appt.queue.site);
            const lateToleranceMinutes = config.lateToleranceMinutes.value;
            const expirationDeadline = new Date(appt.scheduledTime.getTime() + lateToleranceMinutes * 60 * 1000);
            if (now > expirationDeadline) {
                await this.prisma.customer.update({
                    where: { customerId: appt.customerId },
                    data: {
                        appointmentStatus: 'expired',
                        status: 'expired',
                        closedAt: now,
                    },
                });
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            this.logger.log(`Expiration de ${expiredCount} rendez-vous non honorés`);
        }
    }
};
exports.AppointmentExpiryService = AppointmentExpiryService;
exports.AppointmentExpiryService = AppointmentExpiryService = AppointmentExpiryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clock_service_1.ClockService])
], AppointmentExpiryService);
//# sourceMappingURL=appointment-expiry.service.js.map