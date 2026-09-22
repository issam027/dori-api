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
exports.QueuesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const queue_config_helper_1 = require("./queue-config.helper");
let QueuesService = class QueuesService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async create(siteId, dto) {
        const site = await this.prisma.site.findUnique({ where: { siteId, isActive: true } });
        if (!site)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.SITE_NOT_FOUND, { siteId });
        const freeTier = await this.prisma.serviceTier.findUnique({ where: { tierCode: 'free' } });
        if (!freeTier)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR, { error: 'Forfait free introuvable' });
        return this.prisma.$transaction(async (tx) => {
            const queue = await tx.queue.create({
                data: {
                    siteId,
                    queueCode: dto.queueCode,
                    queueName: dto.queueName,
                    averageWaitTime: dto.averageWaitTime ?? 10,
                    threadCount: dto.threadCount ?? 1,
                    appointmentsEnabled: dto.appointmentsEnabled,
                    appointmentSlotDuration: dto.appointmentSlotDuration,
                    slotCapacity: dto.slotCapacity,
                    workingHoursStart: dto.workingHoursStart,
                    workingHoursEnd: dto.workingHoursEnd,
                    breakStart: dto.breakStart,
                    breakEnd: dto.breakEnd,
                    lateToleranceMinutes: dto.lateToleranceMinutes,
                    baseWeightWalkin: dto.baseWeightWalkin,
                    baseWeightAppointment: dto.baseWeightAppointment,
                    escalationRateWalkin: dto.escalationRateWalkin,
                    escalationRateAppointment: dto.escalationRateAppointment,
                    carryOverWaiting: dto.carryOverWaiting,
                    dailyResetMode: dto.dailyResetMode,
                    dailyResetTime: dto.dailyResetTime,
                },
            });
            await tx.queueServiceTier.create({
                data: {
                    queueId: queue.queueId,
                    tierId: freeTier.tierId,
                    price: 0,
                    currency: site.defaultCurrency,
                    displayOrder: 0,
                    isActive: true,
                },
            });
            return queue;
        });
    }
    async findById(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findFirst({
            where: { queueId, isActive: true },
            include: { site: true },
        });
        if (!queue) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        }
        return (0, queue_config_helper_1.resolveQueueConfig)(queue, queue.site);
    }
    async findBySite(user, siteId) {
        await this.scopeService.validateSiteScope(user, siteId);
        const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
        const whereClause = { siteId, isActive: true };
        if (allowedQueueIds !== null) {
            whereClause.queueId = { in: allowedQueueIds };
        }
        const queues = await this.prisma.queue.findMany({
            where: whereClause,
            include: { site: true },
            orderBy: { queueCode: 'asc' },
        });
        return queues.map((q) => (0, queue_config_helper_1.resolveQueueConfig)(q, q.site));
    }
    async update(user, queueId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        const updated = await this.prisma.queue.update({
            where: { queueId },
            data: dto,
            include: { site: true },
        });
        return (0, queue_config_helper_1.resolveQueueConfig)(updated, updated.site);
    }
    async delete(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.queue.update({
            where: { queueId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
    }
    async getStatus(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));
        const waitingCount = await this.prisma.customer.count({
            where: {
                queueId,
                businessDate,
                status: 'waiting',
                isActive: true,
            },
        });
        const activeSessions = await this.prisma.queueSession.findMany({
            where: {
                queueId,
                disconnectedAt: null,
                mode: 'active',
            },
        });
        const activeThreadsCount = Math.max(1, activeSessions.length);
        const estimatedWaitMinutes = Math.round((waitingCount * queue.averageWaitTime) / activeThreadsCount);
        const nextAppointments = await this.prisma.customer.findMany({
            where: {
                queueId,
                businessDate,
                entryType: 'appointment',
                appointmentStatus: { in: ['booked', 'checked_in'] },
                isActive: true,
            },
            orderBy: { scheduledTime: 'asc' },
            take: 5,
            select: {
                customerId: true,
                ticketNumber: true,
                scheduledTime: true,
                appointmentStatus: true,
                status: true,
            },
        });
        return {
            queueId,
            queueCode: queue.queueCode,
            waitingCount,
            activeThreadsCount,
            totalThreads: queue.threadCount,
            estimatedWaitMinutes,
            nextAppointments,
        };
    }
    async getThreads(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({ where: { queueId } });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const activeSessions = await this.prisma.queueSession.findMany({
            where: {
                queueId,
                disconnectedAt: null,
                mode: 'active',
                threadNumber: { not: null },
            },
            include: {
                user: { select: { userId: true, username: true } },
                customers: {
                    where: { status: 'in_progress', isActive: true },
                    select: { customerId: true },
                    take: 1,
                },
            },
        });
        const sessionByThread = new Map();
        activeSessions.forEach((s) => {
            if (s.threadNumber)
                sessionByThread.set(s.threadNumber, s);
        });
        const now = this.clockService.now();
        const threads = [];
        for (let t = 1; t <= queue.threadCount; t++) {
            const session = sessionByThread.get(t);
            if (!session) {
                threads.push({
                    threadNumber: t,
                    status: 'free',
                    session: null,
                });
            }
            else {
                const inactiveMinutes = this.clockService.diffInMinutes(now, session.lastSeenAt);
                const currentRegId = session.customers.length > 0 ? session.customers[0].customerId : null;
                threads.push({
                    threadNumber: t,
                    status: 'occupied',
                    session: {
                        sessionId: session.sessionId,
                        userId: session.user.userId,
                        username: session.user.username,
                        connectedAt: session.connectedAt.toISOString(),
                        lastSeenAt: session.lastSeenAt.toISOString(),
                        inactiveMinutes,
                        currentRegistrationId: currentRegId,
                    },
                });
            }
        }
        return {
            queueId: queue.queueId,
            threadCount: queue.threadCount,
            threads,
        };
    }
    async getOperators(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const userQueues = await this.prisma.userQueue.findMany({
            where: { queueId },
            include: {
                user: {
                    select: {
                        userId: true,
                        username: true,
                        email: true,
                        userType: true,
                    },
                },
            },
        });
        return userQueues.map((uq) => uq.user);
    }
    async assignOperator(user, queueId, targetUserId) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.userQueue.upsert({
            where: { userId_queueId: { userId: targetUserId, queueId } },
            update: {},
            create: { userId: targetUserId, queueId },
        });
    }
    async unassignOperator(user, queueId, targetUserId) {
        await this.scopeService.validateQueueScope(user, queueId);
        await this.prisma.userQueue.deleteMany({
            where: { userId: targetUserId, queueId },
        });
        return { success: true };
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], QueuesService);
//# sourceMappingURL=queues.service.js.map