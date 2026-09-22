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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    scopeService;
    clockService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async findAll(user, pagination, registrationId, channel, status) {
        const whereClause = {};
        if (registrationId)
            whereClause.customerId = registrationId;
        if (channel)
            whereClause.channel = channel;
        if (status)
            whereClause.notificationStatus = status;
        const [items, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    customer: {
                        select: {
                            ticketNumber: true,
                            queueId: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where: whereClause }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findById(user, notificationId) {
        const notification = await this.prisma.notification.findUnique({
            where: { notificationId },
            include: { customer: true },
        });
        if (!notification) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { notificationId });
        }
        await this.scopeService.validateQueueScope(user, notification.customer.queueId);
        return notification;
    }
    async resend(user, notificationId) {
        const notification = await this.findById(user, notificationId);
        const updated = await this.prisma.notification.update({
            where: { notificationId },
            data: {
                notificationStatus: 'pending',
                attemptCount: { increment: 1 },
                failureReason: null,
            },
        });
        return updated;
    }
    async handleWebhook(provider, dto) {
        const notification = await this.prisma.notification.findFirst({
            where: { providerMessageId: dto.providerMessageId },
        });
        if (!notification) {
            this.logger.warn(`Webhook ${provider}: Message non trouvé (${dto.providerMessageId})`);
            return { received: true };
        }
        const now = this.clockService.now();
        await this.prisma.notification.update({
            where: { notificationId: notification.notificationId },
            data: {
                notificationStatus: dto.status === 'delivered' ? 'delivered' : 'failed',
                deliveredAt: dto.status === 'delivered' ? now : undefined,
                failureReason: dto.failureReason,
            },
        });
        return { success: true };
    }
    async evaluateQueueThresholds(queueId) {
        const queue = await this.prisma.queue.findUnique({
            where: { queueId, isActive: true },
            include: { site: true },
        });
        if (!queue)
            return;
        const businessDate = new Date(this.clockService.getBusinessDate(queue.site.timezone));
        const waitingCustomers = await this.prisma.customer.findMany({
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
            include: {
                person: true,
                queueTier: {
                    include: {
                        notificationRules: {
                            where: { notificationType: 'threshold', isActive: true },
                        },
                    },
                },
            },
        });
        const activeSessionsCount = await this.prisma.queueSession.count({
            where: { queueId, disconnectedAt: null, mode: 'active' },
        });
        const threads = Math.max(1, activeSessionsCount);
        for (let i = 0; i < waitingCustomers.length; i++) {
            const customer = waitingCustomers[i];
            const position = i + 1;
            const estimatedWaitMinutes = Math.round((position * queue.averageWaitTime) / threads);
            for (const rule of customer.queueTier.notificationRules) {
                const triggersPosition = rule.thresholdPosition !== null && position <= rule.thresholdPosition;
                const triggersMinutes = rule.thresholdMinutes !== null && estimatedWaitMinutes <= rule.thresholdMinutes;
                if (triggersPosition || triggersMinutes) {
                    const existingNotif = await this.prisma.notification.findFirst({
                        where: {
                            customerId: customer.customerId,
                            notificationType: 'threshold',
                            channel: rule.channel,
                            notificationStatus: { not: 'failed' },
                        },
                    });
                    if (!existingNotif) {
                        const locale = customer.languagePreference || customer.person.languagePreference || 'fr';
                        const recipient = rule.channel === 'email' ? customer.person.email : customer.person.phoneNumber;
                        if (recipient) {
                            await this.prisma.notification.create({
                                data: {
                                    customerId: customer.customerId,
                                    ruleId: rule.ruleId,
                                    channel: rule.channel,
                                    notificationType: 'threshold',
                                    locale,
                                    recipient,
                                    notificationContent: `${customer.person.firstName || 'Client'}, votre tour approche. Ticket ${customer.ticketNumber}. Position: ${position}, attente: ~${estimatedWaitMinutes} min.`,
                                    notificationStatus: 'pending',
                                },
                            });
                        }
                    }
                }
            }
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map