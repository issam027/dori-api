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
var QueueEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEngineService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const queue_config_helper_1 = require("../queues/queue-config.helper");
let QueueEngineService = QueueEngineService_1 = class QueueEngineService {
    prisma;
    scopeService;
    clockService;
    logger = new common_1.Logger(QueueEngineService_1.name);
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async openSession(user, queueId, dto) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId, isActive: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const now = this.clockService.now();
        if (dto.mode === 'consultation_only') {
            const session = await this.prisma.queueSession.create({
                data: {
                    queueId,
                    userId: user.userId,
                    threadNumber: null,
                    mode: 'consultation_only',
                    connectedAt: now,
                    lastSeenAt: now,
                },
            });
            return {
                code: 'OK',
                translationKey: 'session.connected_readonly',
                translationParams: {},
                data: {
                    sessionId: session.sessionId,
                    queueId: session.queueId,
                    userId: session.userId,
                    threadNumber: null,
                    mode: 'consultation_only',
                    connectedAt: session.connectedAt.toISOString(),
                },
            };
        }
        if (!dto.threadNumber || dto.threadNumber < 1 || dto.threadNumber > queue.threadCount) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, {
                field: 'threadNumber',
                message: `Le numéro de guichet doit être compris entre 1 et ${queue.threadCount}`,
            });
        }
        const existingUserSession = await this.prisma.queueSession.findFirst({
            where: {
                queueId,
                userId: user.userId,
                disconnectedAt: null,
            },
        });
        if (existingUserSession) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.SESSION_ALREADY_OPEN, { queueId });
        }
        return this.prisma.$transaction(async (tx) => {
            const existingSession = await tx.queueSession.findFirst({
                where: {
                    queueId,
                    threadNumber: dto.threadNumber,
                    disconnectedAt: null,
                },
                include: {
                    user: { select: { userId: true, username: true } },
                },
            });
            if (existingSession && !dto.takeOver) {
                const inactiveMinutes = this.clockService.diffInMinutes(now, existingSession.lastSeenAt);
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.THREAD_OCCUPIED, {
                    threadNumber: dto.threadNumber,
                    username: existingSession.user.username,
                    inactiveMinutes,
                }, {
                    threadNumber: dto.threadNumber,
                    occupiedBy: {
                        userId: existingSession.user.userId,
                        username: existingSession.user.username,
                        lastSeenAt: existingSession.lastSeenAt.toISOString(),
                    },
                });
            }
            let takenOverFromSessionId = null;
            let reassignedRegistrationId = null;
            if (existingSession && dto.takeOver) {
                takenOverFromSessionId = existingSession.sessionId;
                await tx.queueSession.update({
                    where: { sessionId: existingSession.sessionId },
                    data: {
                        disconnectedAt: now,
                        closureReason: 'taken_over',
                        closedByUserId: user.userId,
                    },
                });
                const clientInProgress = await tx.customer.findFirst({
                    where: {
                        currentSessionId: existingSession.sessionId,
                        status: 'in_progress',
                        isActive: true,
                    },
                });
                if (clientInProgress) {
                    reassignedRegistrationId = clientInProgress.customerId;
                }
            }
            const newSession = await tx.queueSession.create({
                data: {
                    queueId,
                    userId: user.userId,
                    threadNumber: dto.threadNumber,
                    mode: 'active',
                    connectedAt: now,
                    lastSeenAt: now,
                },
            });
            if (reassignedRegistrationId) {
                await tx.customer.update({
                    where: { customerId: reassignedRegistrationId },
                    data: { currentSessionId: newSession.sessionId },
                });
            }
            return {
                code: 'OK',
                translationKey: 'session.connected',
                translationParams: { threadNumber: dto.threadNumber },
                data: {
                    sessionId: newSession.sessionId,
                    queueId: newSession.queueId,
                    userId: newSession.userId,
                    threadNumber: newSession.threadNumber,
                    mode: 'active',
                    connectedAt: newSession.connectedAt.toISOString(),
                    takenOverFromSessionId,
                    reassignedRegistrationId,
                },
            };
        });
    }
    async closeSession(user, queueId, sessionId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const session = await this.prisma.queueSession.findFirst({
            where: { sessionId, queueId, disconnectedAt: null },
        });
        if (!session)
            return { success: true };
        await this.prisma.queueSession.update({
            where: { sessionId },
            data: {
                disconnectedAt: this.clockService.now(),
                closureReason: 'logout',
                closedByUserId: user.userId,
            },
        });
        return { success: true };
    }
    async callNext(user, queueId) {
        await this.scopeService.validateQueueScope(user, queueId);
        const activeSession = await this.prisma.queueSession.findFirst({
            where: {
                queueId,
                userId: user.userId,
                disconnectedAt: null,
                mode: 'active',
            },
        });
        if (!activeSession || activeSession.threadNumber === null) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.THREAD_UNAVAILABLE);
        }
        const queue = await this.prisma.queue.findUnique({
            where: { queueId },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const effectiveConfig = (0, queue_config_helper_1.resolveQueueConfig)(queue, queue.site);
        const businessDateStr = this.clockService.getBusinessDate(queue.site.timezone);
        const now = this.clockService.now();
        const qBaseAppt = effectiveConfig.baseWeightAppointment.value;
        const qRateAppt = effectiveConfig.escalationRateAppointment.value;
        const qBaseWalk = effectiveConfig.baseWeightWalkin.value;
        const qRateWalk = effectiveConfig.escalationRateWalkin.value;
        return this.prisma.$transaction(async (tx) => {
            const eligibleRows = await tx.$queryRaw `
        WITH eligible AS (
          SELECT c.customer_id,
                 CASE WHEN c.entry_type = 'appointment'
                      THEN ${qBaseAppt} + EXTRACT(EPOCH FROM (now() - c.priority_reference_time))/60 * ${qRateAppt}
                      ELSE ${qBaseWalk} + EXTRACT(EPOCH FROM (now() - c.priority_reference_time))/60 * ${qRateWalk}
                 END AS score
          FROM dori_customer c
          WHERE c.queue_id = ${queueId}
            AND c.business_date = ${businessDateStr}::date
            AND c.status = 'waiting'
            AND c.is_active = TRUE
            AND ( c.entry_type = 'walkin'
                  OR (c.appointment_status = 'checked_in' AND c.scheduled_time <= now()) )
        )
        SELECT customer_id, score FROM eligible
        ORDER BY score DESC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
      `;
            let selectedCustomerId = null;
            let calculatedScore = 0;
            let calledEarly = false;
            if (eligibleRows.length > 0) {
                selectedCustomerId = eligibleRows[0].customer_id;
                calculatedScore = Number(eligibleRows[0].score);
            }
            else {
                const fallbackRows = await tx.$queryRaw `
          SELECT customer_id
          FROM dori_customer
          WHERE queue_id = ${queueId}
            AND business_date = ${businessDateStr}::date
            AND status = 'waiting'
            AND is_active = TRUE
            AND appointment_status = 'checked_in'
            AND scheduled_time > now()
          ORDER BY scheduled_time ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1;
        `;
                if (fallbackRows.length > 0) {
                    selectedCustomerId = fallbackRows[0].customer_id;
                    calculatedScore = 0;
                    calledEarly = true;
                }
            }
            if (!selectedCustomerId) {
                return {
                    code: 'QUEUE_EMPTY',
                    translationKey: 'queue.next.empty',
                    translationParams: {},
                    data: null,
                };
            }
            const updatedCustomer = await tx.customer.update({
                where: { customerId: selectedCustomerId },
                data: {
                    status: 'in_progress',
                    currentSessionId: activeSession.sessionId,
                    calledAt: now,
                },
                include: {
                    person: {
                        include: {
                            notes: { where: { isActive: true }, select: { noteId: true }, take: 1 },
                        },
                    },
                    queueTier: {
                        include: { tier: true },
                    },
                },
            });
            return {
                code: 'OK',
                translationKey: 'queue.next.called',
                translationParams: { ticketNumber: updatedCustomer.ticketNumber },
                data: {
                    registrationId: updatedCustomer.customerId,
                    ticketNumber: updatedCustomer.ticketNumber,
                    entryType: updatedCustomer.entryType,
                    scheduledTime: updatedCustomer.scheduledTime?.toISOString() || null,
                    calledEarly,
                    tier: {
                        tierId: updatedCustomer.queueTier.tier.tierId,
                        tierCode: updatedCustomer.queueTier.tier.tierCode,
                        tierName: updatedCustomer.queueTier.tier.tierName,
                    },
                    status: 'in_progress',
                    sessionId: activeSession.sessionId,
                    threadNumber: activeSession.threadNumber,
                    priorityScore: Math.round(calculatedScore * 10) / 10,
                    calledAt: updatedCustomer.calledAt?.toISOString(),
                    person: {
                        personId: updatedCustomer.person.personId,
                        firstName: updatedCustomer.person.firstName,
                        lastName: updatedCustomer.person.lastName,
                        phone: updatedCustomer.person.phoneNumber,
                        hasNotes: updatedCustomer.person.notes.length > 0,
                    },
                },
            };
        });
    }
    async markServed(user, registrationId) {
        const customer = await this.prisma.customer.findUnique({
            where: { customerId: registrationId },
            include: { currentSession: true },
        });
        if (!customer) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
        }
        await this.scopeService.validateQueueScope(user, customer.queueId);
        if (customer.status !== 'in_progress') {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_IN_PROGRESS, { status: customer.status });
        }
        const now = this.clockService.now();
        const updated = await this.prisma.customer.update({
            where: { customerId: registrationId },
            data: {
                status: 'served',
                servedAt: now,
                closedAt: now,
            },
        });
        return {
            code: 'OK',
            translationKey: 'registration.served',
            translationParams: {},
            data: {
                registrationId: updated.customerId,
                status: 'served',
                servedAt: updated.servedAt?.toISOString(),
                closedAt: updated.closedAt?.toISOString(),
                handledBySessionId: customer.currentSessionId,
                handledByUserId: customer.currentSession?.userId || user.userId,
            },
        };
    }
    async markNoShow(user, registrationId) {
        const customer = await this.prisma.customer.findUnique({
            where: { customerId: registrationId },
            include: { currentSession: true },
        });
        if (!customer) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
        }
        await this.scopeService.validateQueueScope(user, customer.queueId);
        if (customer.status !== 'in_progress') {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_IN_PROGRESS, { status: customer.status });
        }
        const now = this.clockService.now();
        const updated = await this.prisma.customer.update({
            where: { customerId: registrationId },
            data: {
                status: 'no_show',
                servedAt: null,
                closedAt: now,
            },
        });
        return {
            code: 'OK',
            translationKey: 'registration.no_show',
            translationParams: {},
            data: {
                registrationId: updated.customerId,
                status: 'no_show',
                servedAt: null,
                closedAt: updated.closedAt?.toISOString(),
                handledBySessionId: customer.currentSessionId,
                handledByUserId: customer.currentSession?.userId || user.userId,
            },
        };
    }
};
exports.QueueEngineService = QueueEngineService;
exports.QueueEngineService = QueueEngineService = QueueEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], QueueEngineService);
//# sourceMappingURL=queue-engine.service.js.map