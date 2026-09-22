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
exports.ServiceTiersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let ServiceTiersService = class ServiceTiersService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async findAllTiers(pagination) {
        const [items, total] = await Promise.all([
            this.prisma.serviceTier.findMany({
                where: { isActive: true },
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { tierId: 'asc' },
            }),
            this.prisma.serviceTier.count({ where: { isActive: true } }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findTierById(tierId) {
        const tier = await this.prisma.serviceTier.findFirst({
            where: { tierId, isActive: true },
        });
        if (!tier)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { tierId });
        return tier;
    }
    async createTier(dto) {
        return this.prisma.serviceTier.create({
            data: {
                tierCode: dto.tierCode,
                tierName: dto.tierName,
                description: dto.description,
                isSystem: false,
            },
        });
    }
    async updateTier(tierId, dto) {
        const tier = await this.findTierById(tierId);
        return this.prisma.serviceTier.update({
            where: { tierId },
            data: dto,
        });
    }
    async deleteTier(tierId) {
        const tier = await this.findTierById(tierId);
        if (tier.isSystem) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TIER_IS_SYSTEM, { tierId });
        }
        return this.prisma.serviceTier.update({
            where: { tierId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
    }
    async findTiersByQueue(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queueTiers = await this.prisma.queueServiceTier.findMany({
            where: { queueId, isActive: true },
            include: {
                tier: true,
                notificationRules: {
                    where: { isActive: true },
                },
            },
            orderBy: { displayOrder: 'asc' },
        });
        return queueTiers.map((qt) => ({
            tierId: qt.tierId,
            tierCode: qt.tier.tierCode,
            tierName: qt.tier.tierName,
            isSystem: qt.tier.isSystem,
            price: Number(qt.price),
            currency: qt.currency,
            displayOrder: qt.displayOrder,
            notificationRules: qt.notificationRules,
        }));
    }
    async associateTierToQueue(user, queueId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        const tier = await this.findTierById(dto.tierId);
        return this.prisma.queueServiceTier.upsert({
            where: { queueId_tierId: { queueId, tierId: dto.tierId } },
            update: {
                price: dto.price,
                currency: dto.currency || 'TND',
                displayOrder: dto.displayOrder ?? 0,
                isActive: true,
            },
            create: {
                queueId,
                tierId: dto.tierId,
                price: dto.price,
                currency: dto.currency || 'TND',
                displayOrder: dto.displayOrder ?? 0,
                isActive: true,
            },
        });
    }
    async updateQueueTier(user, queueId, tierId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.queueServiceTier.update({
            where: { queueId_tierId: { queueId, tierId } },
            data: dto,
        });
    }
    async deleteQueueTier(user, queueId, tierId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const tier = await this.findTierById(tierId);
        if (tier.isSystem || tier.tierCode === 'free') {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TIER_IS_SYSTEM, { tierId });
        }
        return this.prisma.queueServiceTier.update({
            where: { queueId_tierId: { queueId, tierId } },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
    }
    async findRulesByQueueTier(user, queueId, tierId) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.tierNotificationRule.findMany({
            where: { queueId, tierId, isActive: true },
            orderBy: { ruleId: 'asc' },
        });
    }
    async createNotificationRule(user, queueId, tierId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        if (dto.notificationType === 'threshold' &&
            dto.thresholdPosition === undefined &&
            dto.thresholdMinutes === undefined) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, {
                message: 'Une règle threshold requiert thresholdPosition ou thresholdMinutes',
            });
        }
        return this.prisma.tierNotificationRule.create({
            data: {
                queueId,
                tierId,
                notificationType: dto.notificationType,
                channel: dto.channel,
                thresholdPosition: dto.thresholdPosition,
                thresholdMinutes: dto.thresholdMinutes,
                includeTrackingLink: dto.includeTrackingLink ?? false,
            },
        });
    }
    async updateNotificationRule(user, queueId, tierId, ruleId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.tierNotificationRule.update({
            where: { ruleId },
            data: dto,
        });
    }
    async deleteNotificationRule(user, queueId, tierId, ruleId) {
        await this.scopeService.validateQueueScope(user, queueId);
        return this.prisma.tierNotificationRule.update({
            where: { ruleId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
    }
    async getDisplayScreen(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));
        const inProgressCustomers = await this.prisma.customer.findMany({
            where: {
                queueId,
                businessDate,
                status: 'in_progress',
                isActive: true,
            },
            include: {
                currentSession: true,
            },
        });
        const currentByThread = inProgressCustomers.map((c) => ({
            threadNumber: c.currentSession?.threadNumber || null,
            ticketNumber: c.ticketNumber,
        }));
        const nextWaiting = await this.prisma.customer.findMany({
            where: {
                queueId,
                businessDate,
                status: 'waiting',
                isActive: true,
                OR: [
                    { entryType: 'walkin' },
                    { entryType: 'appointment', appointmentStatus: 'checked_in' },
                ],
            },
            orderBy: { priorityReferenceTime: 'asc' },
            take: 5,
            select: {
                ticketNumber: true,
            },
        });
        return {
            queueId,
            queueCode: queue.queueCode,
            queueName: queue.queueName,
            currentCalls: currentByThread,
            nextTickets: nextWaiting.map((c) => c.ticketNumber),
        };
    }
};
exports.ServiceTiersService = ServiceTiersService;
exports.ServiceTiersService = ServiceTiersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], ServiceTiersService);
//# sourceMappingURL=service-tiers.service.js.map