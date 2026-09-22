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
exports.RegistrationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const queue_config_helper_1 = require("../queues/queue-config.helper");
let RegistrationsService = class RegistrationsService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async create(user, dto) {
        await this.scopeService.validateQueueScope(user, dto.queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId: dto.queueId, isActive: true },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId: dto.queueId });
        const effectiveConfig = (0, queue_config_helper_1.resolveQueueConfig)(queue, queue.site);
        const queueTier = await this.prisma.queueServiceTier.findUnique({
            where: {
                queueId_tierId: { queueId: dto.queueId, tierId: dto.tierId },
            },
            include: {
                tier: true,
                notificationRules: { where: { isActive: true } },
            },
        });
        if (!queueTier || !queueTier.isActive) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TIER_NOT_OFFERED_BY_QUEUE, {
                tierId: dto.tierId,
                queueId: dto.queueId,
            });
        }
        let personId = dto.personId;
        if (!personId && dto.person) {
            const createdPerson = await this.prisma.person.create({
                data: {
                    firstName: dto.person.firstName,
                    lastName: dto.person.lastName,
                    email: dto.person.email,
                    phoneNumber: dto.person.phoneNumber,
                    birthDate: dto.person.birthDate ? new Date(dto.person.birthDate) : undefined,
                    languagePreference: dto.person.languagePreference || 'fr',
                },
            });
            personId = createdPerson.personId;
        }
        if (!personId) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, {
                message: 'personId ou les détails de la personne sont obligatoires',
            });
        }
        const activeRegistration = await this.prisma.customer.findFirst({
            where: {
                queueId: dto.queueId,
                personId,
                status: { in: ['waiting', 'in_progress'] },
                isActive: true,
            },
        });
        if (activeRegistration) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.DUPLICATE_ACTIVE_REGISTRATION, { queueId: dto.queueId, personId });
        }
        const now = this.clockService.now();
        let businessDateStr;
        let scheduledTimeDate = null;
        let appointmentStatus = 'n/a';
        let priorityReferenceTime;
        if (dto.entryType === 'appointment') {
            if (!effectiveConfig.appointmentsEnabled.value) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENTS_DISABLED, { queueId: dto.queueId });
            }
            if (!dto.scheduledTime) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'scheduledTime' });
            }
            scheduledTimeDate = new Date(dto.scheduledTime);
            businessDateStr = this.clockService.getBusinessDate(queue.site.timezone, scheduledTimeDate);
            appointmentStatus = 'booked';
            priorityReferenceTime = scheduledTimeDate;
            const slotCapacity = effectiveConfig.slotCapacity.value;
            const bookedCount = await this.prisma.customer.count({
                where: {
                    queueId: dto.queueId,
                    entryType: 'appointment',
                    scheduledTime: scheduledTimeDate,
                    appointmentStatus: { in: ['booked', 'checked_in'] },
                    isActive: true,
                },
            });
            if (bookedCount >= slotCapacity) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENT_SLOT_FULL, {
                    scheduledTime: dto.scheduledTime,
                });
            }
        }
        else {
            businessDateStr = this.clockService.getBusinessDate(queue.site.timezone, now);
            priorityReferenceTime = now;
        }
        const validUntil = this.clockService.getEndOfBusinessDay(queue.site.timezone, dto.entryType === 'appointment' && scheduledTimeDate ? scheduledTimeDate : now);
        return this.prisma.$transaction(async (tx) => {
            const counterRow = await tx.$queryRaw `
        INSERT INTO dori_queue_counter (queue_id, business_date, last_number)
        VALUES (${dto.queueId}, ${businessDateStr}::date, 1)
        ON CONFLICT (queue_id, business_date)
        DO UPDATE SET last_number = dori_queue_counter.last_number + 1,
                      updated_at  = CURRENT_TIMESTAMP
        RETURNING last_number;
      `;
            const lastNumber = counterRow[0].last_number;
            const ticketNumber = `${queue.queueCode}${String(lastNumber).padStart(3, '0')}`;
            const customer = await tx.customer.create({
                data: {
                    personId,
                    queueId: dto.queueId,
                    tierId: dto.tierId,
                    businessDate: new Date(businessDateStr),
                    ticketNumber,
                    entryType: dto.entryType,
                    scheduledTime: scheduledTimeDate,
                    appointmentStatus,
                    priorityReferenceTime,
                    status: 'waiting',
                    registrationTrackingTokenValidUntil: validUntil,
                    createdByUserId: user.userId,
                },
            });
            const hasTrackingLinkRule = queueTier.notificationRules.some((r) => r.includeTrackingLink);
            const trackingBaseUrl = process.env.TRACKING_BASE_URL || 'https://suivi.dori.tn';
            const trackingUrl = hasTrackingLinkRule
                ? `${trackingBaseUrl}/#${customer.registrationTrackingToken}`
                : undefined;
            return {
                code: 'OK',
                translationKey: 'registration.created',
                translationParams: { ticketNumber: customer.ticketNumber },
                data: {
                    registrationId: customer.customerId,
                    ticketNumber: customer.ticketNumber,
                    businessDate: businessDateStr,
                    entryType: customer.entryType,
                    appointmentStatus: customer.appointmentStatus,
                    scheduledTime: customer.scheduledTime?.toISOString() || null,
                    status: customer.status,
                    tier: {
                        tierId: queueTier.tier.tierId,
                        tierCode: queueTier.tier.tierCode,
                        price: Number(queueTier.price),
                        currency: queueTier.currency,
                    },
                    priorityReferenceTime: customer.priorityReferenceTime.toISOString(),
                    trackingUrl,
                    registrationTrackingTokenValidUntil: customer.registrationTrackingTokenValidUntil.toISOString(),
                },
            };
        });
    }
    async reschedule(user, registrationId, dto) {
        const customer = await this.prisma.customer.findUnique({
            where: { customerId: registrationId },
            include: { queue: { include: { site: true } } },
        });
        if (!customer) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
        }
        await this.scopeService.validateQueueScope(user, customer.queueId);
        if (customer.appointmentStatus === 'expired') {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENT_EXPIRED);
        }
        if (['served', 'no_show', 'expired'].includes(customer.status)) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_CLOSED);
        }
        const effectiveConfig = (0, queue_config_helper_1.resolveQueueConfig)(customer.queue, customer.queue.site);
        const newScheduledTime = new Date(dto.scheduledTime);
        const bookedCount = await this.prisma.customer.count({
            where: {
                queueId: customer.queueId,
                entryType: 'appointment',
                scheduledTime: newScheduledTime,
                appointmentStatus: { in: ['booked', 'checked_in'] },
                isActive: true,
                customerId: { not: registrationId },
            },
        });
        if (bookedCount >= effectiveConfig.slotCapacity.value) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENT_SLOT_FULL, {
                scheduledTime: dto.scheduledTime,
            });
        }
        const updated = await this.prisma.customer.update({
            where: { customerId: registrationId },
            data: {
                scheduledTime: newScheduledTime,
                priorityReferenceTime: newScheduledTime,
                appointmentStatus: 'booked',
                checkedInAt: null,
            },
        });
        return {
            code: 'OK',
            translationKey: 'appointment.rescheduled',
            translationParams: { scheduledTime: dto.scheduledTime },
            data: {
                registrationId: updated.customerId,
                appointmentStatus: updated.appointmentStatus,
                scheduledTime: updated.scheduledTime?.toISOString(),
                priorityReferenceTime: updated.priorityReferenceTime.toISOString(),
            },
        };
    }
    async checkIn(user, registrationId) {
        const customer = await this.prisma.customer.findUnique({
            where: { customerId: registrationId },
            include: { queue: { include: { site: true } } },
        });
        if (!customer) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
        }
        await this.scopeService.validateQueueScope(user, customer.queueId);
        if (customer.entryType !== 'appointment') {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, {
                message: "Seuls les rendez-vous peuvent faire l'objet d'un check-in",
            });
        }
        const now = this.clockService.now();
        const effectiveConfig = (0, queue_config_helper_1.resolveQueueConfig)(customer.queue, customer.queue.site);
        const lateTolerance = effectiveConfig.lateToleranceMinutes.value;
        if (customer.scheduledTime) {
            const expirationDeadline = new Date(customer.scheduledTime.getTime() + lateTolerance * 60 * 1000);
            if (now > expirationDeadline) {
                await this.prisma.customer.update({
                    where: { customerId: registrationId },
                    data: {
                        appointmentStatus: 'expired',
                        status: 'expired',
                        closedAt: now,
                    },
                });
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENT_EXPIRED);
            }
        }
        const updated = await this.prisma.customer.update({
            where: { customerId: registrationId },
            data: {
                checkedInAt: now,
                appointmentStatus: 'checked_in',
            },
        });
        return {
            code: 'OK',
            translationKey: 'appointment.checked_in',
            translationParams: { ticketNumber: updated.ticketNumber },
            data: {
                registrationId: updated.customerId,
                appointmentStatus: updated.appointmentStatus,
                checkedInAt: updated.checkedInAt?.toISOString(),
            },
        };
    }
    async getAvailability(user, queueId, dateStr) {
        await this.scopeService.validateQueueScope(user, queueId);
        const queue = await this.prisma.queue.findUnique({
            where: { queueId, isActive: true },
            include: { site: true },
        });
        if (!queue)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        const config = (0, queue_config_helper_1.resolveQueueConfig)(queue, queue.site);
        if (!config.appointmentsEnabled.value) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.APPOINTMENTS_DISABLED, { queueId });
        }
        const slotDuration = config.appointmentSlotDuration.value;
        const capacity = config.slotCapacity.value;
        const startStr = config.workingHoursStart.value;
        const endStr = config.workingHoursEnd.value;
        const breakStartStr = config.breakStart.value;
        const breakEndStr = config.breakEnd.value;
        const [startHour, startMin] = startStr.split(':').map(Number);
        const [endHour, endMin] = endStr.split(':').map(Number);
        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const breakStartMinutes = breakStartStr ? breakStartStr.split(':').map(Number)[0] * 60 + breakStartStr.split(':').map(Number)[1] : null;
        const breakEndMinutes = breakEndStr ? breakEndStr.split(':').map(Number)[0] * 60 + breakEndStr.split(':').map(Number)[1] : null;
        const existingAppointments = await this.prisma.customer.findMany({
            where: {
                queueId,
                businessDate: new Date(dateStr),
                entryType: 'appointment',
                appointmentStatus: { in: ['booked', 'checked_in'] },
                isActive: true,
            },
            select: { scheduledTime: true },
        });
        const bookedCountsByTime = new Map();
        existingAppointments.forEach((a) => {
            if (a.scheduledTime) {
                const timeKey = a.scheduledTime.toISOString();
                bookedCountsByTime.set(timeKey, (bookedCountsByTime.get(timeKey) || 0) + 1);
            }
        });
        const slots = [];
        while (currentMinutes + slotDuration <= endMinutes) {
            if (breakStartMinutes !== null &&
                breakEndMinutes !== null &&
                currentMinutes >= breakStartMinutes &&
                currentMinutes < breakEndMinutes) {
                currentMinutes += slotDuration;
                continue;
            }
            const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
            const m = String(currentMinutes % 60).padStart(2, '0');
            const timeStr = `${h}:${m}:00`;
            const slotIso = `${dateStr}T${timeStr}Z`;
            const booked = bookedCountsByTime.get(slotIso) || 0;
            const available = Math.max(0, capacity - booked);
            slots.push({
                time: `${h}:${m}`,
                slotCapacity: capacity,
                bookedCount: booked,
                availableCount: available,
                isFull: available === 0,
            });
            currentMinutes += slotDuration;
        }
        return {
            queueId,
            date: dateStr,
            slotDuration,
            slots,
        };
    }
    async getPublicPosition(trackingToken) {
        const customer = await this.prisma.customer.findUnique({
            where: { registrationTrackingToken: trackingToken },
            include: {
                queue: {
                    include: { site: true },
                },
            },
        });
        if (!customer) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TOKEN_EXPIRED);
        }
        const now = this.clockService.now();
        if (now > customer.registrationTrackingTokenValidUntil) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TOKEN_EXPIRED);
        }
        if (['served', 'no_show', 'expired'].includes(customer.status)) {
            const closedAt = customer.closedAt || customer.updatedAt;
            const minutesSinceClosed = this.clockService.diffInMinutes(now, closedAt);
            if (minutesSinceClosed > 60) {
                return {
                    code: 'REGISTRATION_CLOSED',
                    translationKey: 'public.closed',
                    translationParams: {},
                    data: { status: 'closed' },
                };
            }
        }
        let position = 1;
        let estimatedWaitMinutes = 0;
        if (customer.status === 'waiting') {
            position = await this.prisma.customer.count({
                where: {
                    queueId: customer.queueId,
                    businessDate: customer.businessDate,
                    status: 'waiting',
                    isActive: true,
                    priorityReferenceTime: { lt: customer.priorityReferenceTime },
                },
            }) + 1;
            const activeThreads = await this.prisma.queueSession.count({
                where: { queueId: customer.queueId, disconnectedAt: null, mode: 'active' },
            });
            const threadsCount = Math.max(1, activeThreads);
            estimatedWaitMinutes = Math.round((position * customer.queue.averageWaitTime) / threadsCount);
        }
        return {
            code: 'OK',
            translationKey: 'public.position',
            translationParams: { position, minutes: estimatedWaitMinutes },
            data: {
                ticketNumber: customer.ticketNumber,
                status: customer.status,
                position,
                estimatedWaitMinutes,
            },
        };
    }
    async findAll(user, pagination, queueId, status, entryType) {
        const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
        const whereClause = { isActive: true };
        if (queueId) {
            await this.scopeService.validateQueueScope(user, queueId);
            whereClause.queueId = queueId;
        }
        else if (allowedQueueIds !== null) {
            whereClause.queueId = { in: allowedQueueIds };
        }
        if (status)
            whereClause.status = status;
        if (entryType)
            whereClause.entryType = entryType;
        const [items, total] = await Promise.all([
            this.prisma.customer.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                include: {
                    person: true,
                    queue: { select: { queueCode: true, queueName: true } },
                    queueTier: { include: { tier: true } },
                },
                orderBy: [{ businessDate: 'desc' }, { customerId: 'desc' }],
            }),
            this.prisma.customer.count({ where: whereClause }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findById(user, registrationId) {
        const customer = await this.prisma.customer.findFirst({
            where: { customerId: registrationId, isActive: true },
            include: {
                person: true,
                queue: true,
                queueTier: { include: { tier: true } },
            },
        });
        if (!customer)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
        await this.scopeService.validateQueueScope(user, customer.queueId);
        return customer;
    }
    async delete(user, registrationId) {
        const customer = await this.findById(user, registrationId);
        return this.prisma.customer.update({
            where: { customerId: registrationId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
    }
};
exports.RegistrationsService = RegistrationsService;
exports.RegistrationsService = RegistrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], RegistrationsService);
//# sourceMappingURL=registrations.service.js.map