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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
let ReportsService = class ReportsService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async getQueueDailyReport(user, queueId, dateStr) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const businessDateStr = dateStr || this.clockService.getBusinessDate(queue.site.timezone);
        const businessDate = new Date(businessDateStr);
        const customers = await this.prisma.customer.findMany({
            where: {
                queueId,
                businessDate,
            },
            select: {
                customerId: true,
                status: true,
                entryType: true,
                calledAt: true,
                servedAt: true,
                priorityReferenceTime: true,
            },
        });
        const totalRegistrations = customers.length;
        const servedCount = customers.filter((c) => c.status === 'served').length;
        const noShowCount = customers.filter((c) => c.status === 'no_show').length;
        const waitingCount = customers.filter((c) => c.status === 'waiting').length;
        const expiredCount = customers.filter((c) => c.status === 'expired').length;
        const noShowRate = totalRegistrations > 0 ? Math.round((noShowCount / totalRegistrations) * 100) : 0;
        let totalWaitMinutes = 0;
        let countedServed = 0;
        customers.forEach((c) => {
            if (c.calledAt) {
                const wait = Math.max(0, Math.floor((c.calledAt.getTime() - c.priorityReferenceTime.getTime()) / (1000 * 60)));
                totalWaitMinutes += wait;
                countedServed++;
            }
        });
        const averageWaitTimeActual = countedServed > 0 ? Math.round(totalWaitMinutes / countedServed) : queue.averageWaitTime;
        return {
            queueId,
            queueCode: queue.queueCode,
            businessDate: businessDateStr,
            metrics: {
                totalRegistrations,
                servedCount,
                noShowCount,
                waitingCount,
                expiredCount,
                noShowRatePercent: noShowRate,
                averageWaitTimeActualMinutes: averageWaitTimeActual,
            },
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map