import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import {
  CreateRegistrationDto,
  RescheduleAppointmentDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';
import { resolveQueueConfig } from '../queues/queue-config.helper';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * 6.5 Créer une inscription (walk-in ou RDV)
   */
  async create(user: UserContext, dto: CreateRegistrationDto) {
    await this.scopeService.validateQueueScope(user, dto.queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId: dto.queueId, isActive: true },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId: dto.queueId });

    const effectiveConfig = resolveQueueConfig(queue, queue.site);

    // Vérification de la disponibilité du forfait pour cette queue (§4.1)
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
      throw new AppException(ErrorCode.TIER_NOT_OFFERED_BY_QUEUE, {
        tierId: dto.tierId,
        queueId: dto.queueId,
      });
    }

    // Résolution de l'identité de la personne (existante ou inline)
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
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: 'personId ou les détails de la personne sont obligatoires',
      });
    }

    // Vérification de non-doublon d'inscription active (§3.10)
    const activeRegistration = await this.prisma.customer.findFirst({
      where: {
        queueId: dto.queueId,
        personId,
        status: { in: ['waiting', 'in_progress'] },
        isActive: true,
      },
    });
    if (activeRegistration) {
      throw new AppException(ErrorCode.DUPLICATE_ACTIVE_REGISTRATION, { queueId: dto.queueId, personId });
    }

    const now = this.clockService.now();
    let businessDateStr: string;
    let scheduledTimeDate: Date | null = null;
    let appointmentStatus = 'n/a';
    let priorityReferenceTime: Date;

    if (dto.entryType === 'appointment') {
      if (!effectiveConfig.appointmentsEnabled.value) {
        throw new AppException(ErrorCode.APPOINTMENTS_DISABLED, { queueId: dto.queueId });
      }

      if (!dto.scheduledTime) {
        throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'scheduledTime' });
      }

      scheduledTimeDate = new Date(dto.scheduledTime);
      businessDateStr = this.clockService.getBusinessDate(queue.site.timezone, scheduledTimeDate);
      appointmentStatus = 'booked';
      priorityReferenceTime = scheduledTimeDate;

      // Contrôle de slot_capacity sur le créneau (§4.2, §6.5)
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
        throw new AppException(ErrorCode.APPOINTMENT_SLOT_FULL, {
          scheduledTime: dto.scheduledTime,
        });
      }
    } else {
      businessDateStr = this.clockService.getBusinessDate(queue.site.timezone, now);
      priorityReferenceTime = now;
    }

    const validUntil = this.clockService.getEndOfBusinessDay(
      queue.site.timezone,
      dto.entryType === 'appointment' && scheduledTimeDate ? scheduledTimeDate : now,
    );

    // Transaction atomique : compteur de ticket et création client (§3.11, §7.6)
    return this.prisma.$transaction(async (tx) => {
      const counterRow: any[] = await tx.$queryRaw`
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

      const hasTrackingLinkRule = queueTier.notificationRules.some(
        (r) => r.includeTrackingLink,
      );

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

  /**
   * 6.6 Reprogrammer un rendez-vous
   */
  async reschedule(user: UserContext, registrationId: number, dto: RescheduleAppointmentDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { customerId: registrationId },
      include: { queue: { include: { site: true } } },
    });

    if (!customer) {
      throw new AppException(ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
    }

    await this.scopeService.validateQueueScope(user, customer.queueId);

    if (customer.appointmentStatus === 'expired') {
      throw new AppException(ErrorCode.APPOINTMENT_EXPIRED);
    }

    if (['served', 'no_show', 'expired'].includes(customer.status)) {
      throw new AppException(ErrorCode.REGISTRATION_CLOSED);
    }

    const effectiveConfig = resolveQueueConfig(customer.queue, customer.queue.site);
    const newScheduledTime = new Date(dto.scheduledTime);

    // Contrôle de capacité sur le nouveau créneau
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
      throw new AppException(ErrorCode.APPOINTMENT_SLOT_FULL, {
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

  /**
   * Pointage d'arrivée (Check-in) (§4.3)
   */
  async checkIn(user: UserContext, registrationId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { customerId: registrationId },
      include: { queue: { include: { site: true } } },
    });

    if (!customer) {
      throw new AppException(ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
    }

    await this.scopeService.validateQueueScope(user, customer.queueId);

    if (customer.entryType !== 'appointment') {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: "Seuls les rendez-vous peuvent faire l'objet d'un check-in",
      });
    }

    const now = this.clockService.now();
    const effectiveConfig = resolveQueueConfig(customer.queue, customer.queue.site);
    const lateTolerance = effectiveConfig.lateToleranceMinutes.value;

    if (customer.scheduledTime) {
      const expirationDeadline = new Date(customer.scheduledTime.getTime() + lateTolerance * 60 * 1000);
      if (now > expirationDeadline) {
        // Expiration immédiate du RDV (§4.3)
        await this.prisma.customer.update({
          where: { customerId: registrationId },
          data: {
            appointmentStatus: 'expired',
            status: 'expired',
            closedAt: now,
          },
        });
        throw new AppException(ErrorCode.APPOINTMENT_EXPIRED);
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

  /**
   * Disponibilité des créneaux calculée à la volée (§4.2)
   */
  async getAvailability(user: UserContext, queueId: number, dateStr: string) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId, isActive: true },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const config = resolveQueueConfig(queue, queue.site);
    if (!config.appointmentsEnabled.value) {
      throw new AppException(ErrorCode.APPOINTMENTS_DISABLED, { queueId });
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

    // Récupération des réservations existantes pour la journée
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

    const bookedCountsByTime = new Map<string, number>();
    existingAppointments.forEach((a) => {
      if (a.scheduledTime) {
        const timeKey = a.scheduledTime.toISOString();
        bookedCountsByTime.set(timeKey, (bookedCountsByTime.get(timeKey) || 0) + 1);
      }
    });

    const slots = [];
    while (currentMinutes + slotDuration <= endMinutes) {
      // Sauter la pause si configurée
      if (
        breakStartMinutes !== null &&
        breakEndMinutes !== null &&
        currentMinutes >= breakStartMinutes &&
        currentMinutes < breakEndMinutes
      ) {
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

  /**
   * 6.8 Suivi public de position (X-Registration-Token)
   */
  async getPublicPosition(trackingToken: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { registrationTrackingToken: trackingToken },
      include: {
        queue: {
          include: { site: true },
        },
      },
    });

    if (!customer) {
      throw new AppException(ErrorCode.TOKEN_EXPIRED);
    }

    const now = this.clockService.now();

    // 410 si le jeton a dépassé sa validité (fin de journée métier §4.14)
    if (now > customer.registrationTrackingTokenValidUntil) {
      throw new AppException(ErrorCode.TOKEN_EXPIRED);
    }

    // Si le client est terminé depuis plus de 60 min -> réponse générique anonymisée (§4.14, §6.8)
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

    // Calcul de la position et de l'attente estimée pour les clients en attente
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

  async findAll(
    user: UserContext,
    pagination: PaginationQueryDto,
    queueId?: number,
    status?: string,
    entryType?: string,
  ) {
    const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
    const whereClause: any = { isActive: true };

    if (queueId) {
      await this.scopeService.validateQueueScope(user, queueId);
      whereClause.queueId = queueId;
    } else if (allowedQueueIds !== null) {
      whereClause.queueId = { in: allowedQueueIds };
    }

    if (status) whereClause.status = status;
    if (entryType) whereClause.entryType = entryType;

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

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findById(user: UserContext, registrationId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { customerId: registrationId, isActive: true },
      include: {
        person: true,
        queue: true,
        queueTier: { include: { tier: true } },
      },
    });

    if (!customer) throw new AppException(ErrorCode.REGISTRATION_NOT_FOUND, { registrationId });
    await this.scopeService.validateQueueScope(user, customer.queueId);

    return customer;
  }

  async delete(user: UserContext, registrationId: number) {
    const customer = await this.findById(user, registrationId);

    return this.prisma.customer.update({
      where: { customerId: registrationId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });
  }
}
