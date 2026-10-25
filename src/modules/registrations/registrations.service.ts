import { Injectable, Optional } from '@nestjs/common';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  RescheduleRegistrationDto,
  LookupRegistrationDto,
  RegistrationFilterDto,
  RegistrationAvailabilityQueryDto,
} from './dto/registration.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PersonsService } from '../persons/persons.service';
import { PaginatedResult } from '../../core/pagination/pagination.dto';
import {
  RegistrationResponseDto,
  SlotAvailabilityItemDto,
} from './dto/registration-response.dto';
import { RegistrationsRepository } from './registrations.repository';
import {
  DATE_RANGE_LIMITS,
  inclusiveCalendarDayCount,
} from '../../core/dates/date-range.dto';
import { ConfigService } from '@nestjs/config';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';
import { QueueWaitEstimationService } from '../queue-estimation/queue-wait-estimation.service';
import { RealtimeService } from '../../core/realtime/realtime.service';

const TRACKING_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getIsoDayOfWeek(businessDate: string): number {
  const [year, month, day] = businessDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const jsDay = dateObj.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly registrationsRepository: RegistrationsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly personsService: PersonsService,
    private readonly configService: ConfigService,
    private readonly notificationTemplateService: NotificationTemplateService,
    @Optional()
    private readonly waitEstimationService?: QueueWaitEstimationService,
    @Optional()
    private readonly realtimeService?: RealtimeService,
  ) {}

  private formatTicketNumber(queueCode: string, lastNumber: number): string {
    const trailingZerosMatch = queueCode.match(/0+$/);
    if (trailingZerosMatch) {
      const zerosCount = trailingZerosMatch[0].length;
      const prefix = queueCode.slice(0, -zerosCount);
      const paddedNumber = String(lastNumber).padStart(zerosCount, '0');
      return `${prefix}${paddedNumber}`;
    }
    // Fallback: 3 digits pad
    return `${queueCode}${String(lastNumber).padStart(3, '0')}`;
  }

  async createRegistration(
    dto: CreateRegistrationDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, dto.queueId);
    const result = await this.registrationsRepository.transaction(
      async (tx) => {
        const now = this.clockService.now();

        // 1. Fetch Queue and Site Configuration
        const q = await tx.findQueueConfig(dto.queueId);
        if (!q) {
          throw new DoriException('QUEUE_NOT_FOUND', { queueId: dto.queueId });
        }

        // 2. Resolve a person strictly inside the queue's site.
        let personId = dto.personId;
        if (!personId) {
          if (!dto.person) {
            throw new DoriException(
              'VALIDATION_ERROR',
              {},
              { errors: ['personId or person object is required'] },
            );
          }
          const createdPerson = await this.personsService.createPerson(
            dto.person,
            q.site_id,
            user,
            tx.manager,
          );
          personId = createdPerson.person_id;
        } else {
          if (!(await tx.personExistsInSite(personId, q.site_id))) {
            throw new DoriException('PERSON_NOT_FOUND', { personId });
          }
        }

        const timezone = q.timezone || 'Africa/Tunis';
        const appointmentsEnabled =
          q.appointments_enabled ?? q.default_appointments_enabled ?? false;
        const slotCapacity = q.slot_capacity ?? q.default_slot_capacity ?? 1;

        // 3. Verify Tier Offered By Queue (§4.1, §6.5)
        const tierInfo = await tx.findOfferedTier(dto.queueId, dto.tierId);
        if (!tierInfo) {
          throw new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
            tierId: dto.tierId,
            queueId: dto.queueId,
          });
        }

        // 4. Duplicate Check (§3.10, §6.9)
        if (await tx.hasOpenRegistration(dto.queueId, personId)) {
          throw new DoriException('DUPLICATE_ACTIVE_REGISTRATION');
        }

        // 5. Entry Type Validation and Business Date
        let businessDate: string;
        let scheduledTime: Date | null = null;
        let appointmentStatus: string = 'n/a';
        let status: string = 'waiting';
        let priorityRefTime: Date;

        const workingDays: number[] = q.working_days ??
          q.default_working_days ?? [1, 2, 3, 4, 5];

        if (dto.entryType === 'appointment') {
          if (!appointmentsEnabled) {
            throw new DoriException('APPOINTMENTS_DISABLED');
          }
          if (!dto.scheduledTime) {
            throw new DoriException(
              'VALIDATION_ERROR',
              {},
              { errors: ['scheduledTime is required for appointment'] },
            );
          }

          scheduledTime = this.clockService.parseInTimezone(
            dto.scheduledTime,
            timezone,
          );
          businessDate = this.clockService.dateInTimezone(
            scheduledTime,
            timezone,
          );

          const isoDay = getIsoDayOfWeek(businessDate);
          if (!workingDays.includes(isoDay)) {
            throw new DoriException('QUEUE_CLOSED', {
              businessDate,
              dayOfWeek: isoDay,
            });
          }

          appointmentStatus = 'booked';
          status = 'booked';
          priorityRefTime = scheduledTime;

          // Slot capacity check (§4.2, §6.5)
          const count = await tx.lockAndCountSlot(dto.queueId, scheduledTime);
          if (count >= slotCapacity) {
            throw new DoriException('APPOINTMENT_SLOT_FULL', {
              scheduledTime: dto.scheduledTime,
            });
          }
        } else {
          businessDate = this.clockService.todayInTimezone(timezone);
          const isoDay = getIsoDayOfWeek(businessDate);
          if (!workingDays.includes(isoDay)) {
            throw new DoriException('QUEUE_CLOSED', {
              businessDate,
              dayOfWeek: isoDay,
            });
          }
          status = 'waiting';
          appointmentStatus = 'n/a';
          priorityRefTime = now;
        }

        // 6. Generate Ticket Number Atomically (§3.11, §7.6)
        const lastNumber = await tx.nextTicketNumber(
          dto.queueId,
          businessDate,
          now,
        );
        const ticketNumber = this.formatTicketNumber(q.queue_code, lastNumber);

        // End of business date for tracking token
        const endOfBusinessDay = this.clockService.endOfDayInTimezone(
          businessDate,
          timezone,
        );
        const tokenTtlMinutes = this.configService.getOrThrow<number>(
          'tracking.tokenTtlMinutes',
        );
        const configuredExpiry = this.clockService.addMinutes(
          now,
          tokenTtlMinutes,
        );
        const tokenValidUntil = new Date(
          Math.min(endOfBusinessDay.getTime(), configuredExpiry.getTime()),
        );

        // 7. Insert dorify.dori_registration
        const created = await tx.create({
          dto,
          personId,
          businessDate,
          ticketNumber,
          scheduledTime,
          appointmentStatus,
          priorityReferenceTime: priorityRefTime,
          status,
          tokenValidUntil,
          userId: user.userId,
          now,
        });

        await tx.createWelcomeNotifications({
          registrationId: created.registration_id,
          trackingToken: String(created.registration_tracking_token),
          ticketNumber: created.ticket_number,
          now,
          templateService: this.notificationTemplateService,
        });

        return {
          registrationId: created.registration_id,
          ticketNumber: created.ticket_number,
          businessDate: created.business_date,
          entryType: created.entry_type,
          appointmentStatus: created.appointment_status,
          scheduledTime: created.scheduled_time,
          status: created.status,
          tier: {
            tierId: dto.tierId,
            tierCode: tierInfo.tier_code,
            price: Number(tierInfo.price),
            currency: tierInfo.currency,
          },
          priorityReferenceTime: created.priority_reference_time,
          registrationTrackingToken: created.registration_tracking_token,
          registrationTrackingTokenValidUntil: tokenValidUntil,
        };
      },
    );
    await this.realtimeService?.emitQueueDisplayChanged(
      dto.queueId,
      'registration_created',
    );
    if (dto.entryType !== 'walkin' || !this.waitEstimationService)
      return result;
    const registration = await this.registrationsRepository.findById(
      result.registrationId,
    );
    if (!registration) return result;
    const estimate = await this.waitEstimationService.estimate(
      registration,
      this.clockService.now(),
    );
    return {
      ...result,
      estimatedWaitMinutes: estimate.estimatedWaitMinutes,
      estimationMethod: estimate.method,
      estimationReliable: estimate.isReliable,
      estimationCalculatedAt: estimate.calculatedAt,
    };
  }

  async getAvailability(
    queueId: string,
    queryDto: RegistrationAvailabilityQueryDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const q =
      await this.registrationsRepository.findAvailabilityConfig(queueId);
    if (!q) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
    const appointmentsEnabled =
      q.appointments_enabled ?? q.default_appointments_enabled ?? false;
    if (!appointmentsEnabled) {
      throw new DoriException('APPOINTMENTS_DISABLED');
    }

    const slotDuration =
      q.appointment_slot_duration ?? q.default_appointment_slot_duration ?? 15;
    const slotCapacity = q.slot_capacity ?? q.default_slot_capacity ?? 1;
    const startStr =
      q.working_hours_start ?? q.default_working_hours_start ?? '08:00';
    const endStr =
      q.working_hours_end ?? q.default_working_hours_end ?? '17:00';
    const breakStartStr = q.break_start ?? q.default_break_start;
    const breakEndStr = q.break_end ?? q.default_break_end;

    const dayCount = inclusiveCalendarDayCount(
      queryDto.dateFrom,
      queryDto.dateTo,
    )!;
    const maxDays = queryDto.summaryOnly
      ? DATE_RANGE_LIMITS.availabilitySummaryDays
      : DATE_RANGE_LIMITS.availabilityDetailedDays;
    if (dayCount > maxDays) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: [
            `The inclusive availability range must not exceed ${maxDays} days`,
          ],
        },
      );
    }

    // Generate the slot template once, then apply all bookings loaded by one query.
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const firstSlotMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let breakStartMinutes = -1;
    let breakEndMinutes = -1;
    if (breakStartStr && breakEndStr) {
      const [bsh, bsm] = breakStartStr.split(':').map(Number);
      const [beh, bem] = breakEndStr.split(':').map(Number);
      breakStartMinutes = bsh * 60 + bsm;
      breakEndMinutes = beh * 60 + bem;
    }

    // Count existing bookings for this date and queue
    const bookedCounts =
      await this.registrationsRepository.findBookedSlotsBetween(
        queueId,
        queryDto.dateFrom,
        queryDto.dateTo,
      );

    const bookingMap = new Map<string, number>();
    for (const b of bookedCounts) {
      if (b.scheduled_time) {
        const slotIso = this.clockService.parse(b.scheduled_time).toISOString();
        const count = Number(b.count) || 0;
        bookingMap.set(slotIso, count);

        const dateStr =
          typeof b.business_date === 'string'
            ? b.business_date
            : this.clockService.dateInTimezone(b.scheduled_time, q.timezone);
        bookingMap.set(`${dateStr}|${slotIso}`, count);
      }
    }

    const workingDays: number[] = q.working_days ??
      q.default_working_days ?? [1, 2, 3, 4, 5];

    const days = Array.from({ length: dayCount }, (_, index) => {
      const businessDate = this.clockService.addCalendarDays(
        queryDto.dateFrom,
        index,
      );
      const isoDay = getIsoDayOfWeek(businessDate);
      if (!workingDays.includes(isoDay)) {
        return {
          businessDate,
          isOpen: false,
          capacity: 0,
          booked: 0,
          available: 0,
          ...(queryDto.summaryOnly ? {} : { slots: [] }),
        };
      }

      const slots: SlotAvailabilityItemDto[] = [];
      let currentMinutes = firstSlotMinutes;
      while (currentMinutes + slotDuration <= endMinutes) {
        if (
          breakStartMinutes !== -1 &&
          currentMinutes >= breakStartMinutes &&
          currentMinutes < breakEndMinutes
        ) {
          currentMinutes += slotDuration;
          continue;
        }
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const slotIso = this.clockService
          .fromZonedTime(`${businessDate}T${time}`, q.timezone)
          .toISOString();
        const booked =
          bookingMap.get(slotIso) ??
          bookingMap.get(`${businessDate}|${slotIso}`) ??
          0;
        const available = Math.max(0, slotCapacity - booked);
        slots.push({
          time: slotIso,
          capacity: slotCapacity,
          booked,
          available,
          isAvailable: available > 0,
        });
        currentMinutes += slotDuration;
      }
      const booked = slots.reduce((sum, slot) => sum + slot.booked, 0);
      const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
      return {
        businessDate,
        isOpen: slots.length > 0,
        capacity,
        booked,
        available: Math.max(0, capacity - booked),
        ...(queryDto.summaryOnly ? {} : { slots }),
      };
    });

    return {
      queueId,
      timezone: q.timezone,
      dateFrom: queryDto.dateFrom,
      dateTo: queryDto.dateTo,
      days,
    };
  }

  async checkIn(registrationId: string, user: AuthenticatedUser) {
    const reg =
      await this.registrationsRepository.findForCheckIn(registrationId);
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    await this.scopeService.checkQueueAccess(user, reg.queue_id);

    if (reg.entry_type !== 'appointment' || reg.status !== 'booked') {
      throw new DoriException('REGISTRATION_CLOSED');
    }

    const now = this.clockService.now();
    const tolerance =
      reg.late_tolerance_minutes ?? reg.default_late_tolerance_minutes ?? 60;
    const scheduledTime = this.clockService.parse(reg.scheduled_time);
    const deadline = this.clockService.addMinutes(scheduledTime, tolerance);

    // Late arrival beyond tolerance -> expired (§4.3)
    if (now > deadline) {
      await this.registrationsRepository.expire(registrationId, now);
      throw new DoriException('APPOINTMENT_EXPIRED');
    }

    await this.registrationsRepository.checkIn(registrationId, now);
    const checkedIn =
      await this.registrationsRepository.findById(registrationId);
    if (!checkedIn || !this.waitEstimationService) return checkedIn;
    const estimate = await this.waitEstimationService.estimate(checkedIn, now);
    return {
      ...checkedIn,
      estimated_wait_minutes: estimate.estimatedWaitMinutes,
      estimation_method: estimate.method,
      estimation_reliable: estimate.isReliable,
      estimation_calculated_at: estimate.calculatedAt,
    };
  }

  async reschedule(
    registrationId: string,
    dto: RescheduleRegistrationDto,
    user: AuthenticatedUser,
  ) {
    const reg =
      await this.registrationsRepository.findForReschedule(registrationId);
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    await this.scopeService.checkQueueAccess(user, reg.queue_id);

    if (reg.entry_type !== 'appointment') {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['Only appointments can be rescheduled'] },
      );
    }

    if (['served', 'no_show', 'expired', 'cancelled'].includes(reg.status)) {
      throw new DoriException('REGISTRATION_CLOSED');
    }

    const newTime = this.clockService.parseInTimezone(
      dto.scheduledTime,
      reg.timezone || 'Africa/Tunis',
    );
    const slotCapacity = reg.slot_capacity ?? reg.default_slot_capacity ?? 1;

    return this.registrationsRepository.transaction(async (tx) => {
      const existing = await tx.lockAndCountSlot(
        reg.queue_id,
        newTime,
        registrationId,
      );
      if (existing >= slotCapacity) {
        throw new DoriException('APPOINTMENT_SLOT_FULL', {
          scheduledTime: dto.scheduledTime,
        });
      }

      const timezone = reg.timezone || 'Africa/Tunis';
      const newBusinessDate = this.clockService.dateInTimezone(
        newTime,
        timezone,
      );
      const now = this.clockService.now();
      let ticketNumber: string | undefined;
      if (newBusinessDate !== String(reg.business_date)) {
        const lastNumber = await tx.nextTicketNumber(
          reg.queue_id,
          newBusinessDate,
          now,
        );
        ticketNumber = this.formatTicketNumber(reg.queue_code, lastNumber);
      }
      const updated = await tx.reschedule(
        registrationId,
        newTime,
        newBusinessDate,
        ticketNumber,
        now,
      );
      return {
        registrationId: updated.registration_id,
        ticketNumber: updated.ticket_number,
        appointmentStatus: updated.appointment_status,
        status: updated.status,
        scheduledTime: updated.scheduled_time,
        priorityReferenceTime: updated.priority_reference_time,
      };
    });
  }

  async lookupAppointment(dto: LookupRegistrationDto, user: AuthenticatedUser) {
    return this.lookup(dto, user);
  }

  async lookup(dto: LookupRegistrationDto, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);

    // Queue scope applies to both modes; phone lookup is restricted to the
    // current business day by the repository using each site's timezone.
    if (!dto.phoneNumber && (!dto.lastName || !dto.scheduledTime)) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['Provide phoneNumber OR (lastName and scheduledTime)'] },
      );
    }

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) {
        throw new DoriException('REGISTRATION_NOT_FOUND');
      }
    }
    const registration = await this.registrationsRepository.lookup({
      queueIds: scope.isGlobal ? undefined : scope.queueIds,
      phoneNumber: dto.phoneNumber,
      lastName: dto.lastName,
      scheduledTime: dto.scheduledTime
        ? this.clockService.parse(dto.scheduledTime)
        : undefined,
      now: this.clockService.now(),
    });
    if (!registration) {
      throw new DoriException('REGISTRATION_NOT_FOUND');
    }
    return registration;
  }

  async findRegistrations(
    filter: RegistrationFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<RegistrationResponseDto>> {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      [
        'registration_id',
        'ticket_number',
        'business_date',
        'status',
        'scheduled_time',
        'created_at',
        'priority_reference_time',
      ],
      'registration_id',
    );

    if (filter.queueId) {
      await this.scopeService.checkQueueAccess(user, filter.queueId);
    } else if (filter.siteId) {
      await this.scopeService.checkSiteAccess(user, filter.siteId);
    } else if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) return filter.createResponse([], 0);
    }
    let dateBounds:
      | {
          dateFrom: string;
          dateTo: string;
          fromInclusive: Date;
          toExclusive: Date;
        }
      | undefined;
    if (filter.dateFrom && filter.dateTo) {
      if (!filter.queueId && !filter.siteId) {
        throw new DoriException(
          'VALIDATION_ERROR',
          {},
          {
            errors: ['queueId or siteId is required with dateFrom/dateTo'],
          },
        );
      }
      const timezone = filter.queueId
        ? (
            await this.registrationsRepository.findAvailabilityConfig(
              filter.queueId,
            )
          )?.timezone
        : await this.registrationsRepository.findSiteTimezone(filter.siteId!);
      if (!timezone) {
        throw new DoriException(
          filter.queueId ? 'QUEUE_NOT_FOUND' : 'SITE_NOT_FOUND',
        );
      }
      dateBounds = {
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        ...this.clockService.dateRangeToUtcBounds(
          filter.dateFrom,
          filter.dateTo,
          timezone,
        ),
      };
    }
    const result = await this.registrationsRepository.findPage(
      filter,
      scope.isGlobal || filter.queueId || filter.siteId
        ? undefined
        : scope.queueIds,
      safeSortField,
      sortOrder,
      pageSize,
      offset,
      dateBounds,
    );
    return filter.createResponse<RegistrationResponseDto>(
      result.items.map((registration): RegistrationResponseDto => ({
        registrationId: String(registration.registration_id),
        queueId: String(registration.queue_id),
        personId: String(registration.person_id),
        ticketNumber: String(registration.ticket_number),
        entryType: String(registration.entry_type),
        status: String(registration.status),
        scheduledTime: registration.scheduled_time
          ? String(registration.scheduled_time)
          : undefined,
        appointmentStatus: registration.appointment_status
          ? String(registration.appointment_status)
          : undefined,
        businessDate: String(registration.business_date),
        registrationTrackingToken: String(
          registration.registration_tracking_token,
        ),
        tierId: String(registration.tier_id),
        createdAt: String(registration.created_at),
        updatedAt: String(registration.updated_at),
        isActive: Boolean(registration.is_active),
        deletedAt: registration.deleted_at
          ? String(registration.deleted_at)
          : null,
        firstName: registration.first_name
          ? String(registration.first_name)
          : undefined,
        lastName: registration.last_name
          ? String(registration.last_name)
          : undefined,
        queueName: registration.queue_name
          ? String(registration.queue_name)
          : undefined,
        tierName: registration.tier_name
          ? String(registration.tier_name)
          : undefined,
        servedBySessionId: registration.served_by_session_id
          ? String(registration.served_by_session_id)
          : null,
        servedByUserId: registration.served_by_user_id
          ? String(registration.served_by_user_id)
          : null,
        activeNoteCount: Number(registration.active_note_count ?? 0),
      })),
      result.total,
    );
  }

  async findRegistrationById(registrationId: string, user: AuthenticatedUser) {
    const reg = await this.registrationsRepository.findById(registrationId);
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    await this.scopeService.checkQueueAccess(user, reg.queue_id);
    if (!this.waitEstimationService || reg.status !== 'waiting') return reg;
    const estimate = await this.waitEstimationService.estimate(
      reg,
      this.clockService.now(),
    );
    return {
      ...reg,
      estimated_wait_minutes: estimate.estimatedWaitMinutes,
      estimation_method: estimate.method,
      estimation_reliable: estimate.isReliable,
      estimation_calculated_at: estimate.calculatedAt,
    };
  }

  async updateRegistration(
    registrationId: string,
    dto: UpdateRegistrationDto,
    user: AuthenticatedUser,
  ) {
    const reg = await this.findRegistrationById(registrationId, user);
    const now = this.clockService.now();

    if (
      ['served', 'no_show', 'expired', 'cancelled'].includes(reg.status) &&
      dto.isActive !== true
    ) {
      throw new DoriException('REGISTRATION_CLOSED');
    }

    if (dto.tierId !== undefined) {
      if (
        !(await this.registrationsRepository.isTierOffered(
          reg.queue_id,
          dto.tierId,
        ))
      ) {
        throw new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
          tierId: dto.tierId,
          queueId: reg.queue_id,
        });
      }
    }
    await this.registrationsRepository.update(
      registrationId,
      dto,
      user.userId,
      now,
    );
    return this.registrationsRepository.findById(registrationId);
  }

  async cancelRegistration(registrationId: string, user: AuthenticatedUser) {
    await this.findRegistrationById(registrationId, user);
    const now = this.clockService.now();

    await this.registrationsRepository.cancel(registrationId, user.userId, now);

    return { registrationId, cancelled: true };
  }

  // Public Tracking Endpoint (§4.14, §6.8)
  async getPublicPosition(trackingToken: string) {
    if (!trackingToken || !TRACKING_TOKEN_PATTERN.test(trackingToken)) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const now = this.clockService.now();
    const reg =
      await this.registrationsRepository.findByTrackingToken(trackingToken);
    if (!reg) {
      throw new DoriException('TOKEN_EXPIRED');
    }

    // Check token expiration date (§4.14)
    if (
      this.clockService.parse(reg.registration_tracking_token_valid_until) < now
    ) {
      throw new DoriException('TOKEN_EXPIRED');
    }

    // Degraded response if finished > 60 minutes (§4.14, §6.8)
    if (
      reg.closed_at &&
      now.getTime() - this.clockService.parse(reg.closed_at).getTime() >
        this.configService.getOrThrow<number>('tracking.closedGraceMinutes') *
          60_000
    ) {
      return {
        status: 'closed',
        registrationStatus: reg.status,
      };
    }

    if (reg.status === 'in_progress') {
      return {
        ticketNumber: reg.ticket_number,
        status: 'in_progress',
        registrationStatus: reg.status,
        position: 0,
        estimatedWaitMinutes: 0,
        counterNumber: reg.thread_number,
        counterName: reg.counter_name,
        calledAt: reg.called_at,
        queueId: reg.queue_id,
        queueName: reg.queue_name,
      };
    }

    if (reg.status === 'waiting') {
      const estimate = this.waitEstimationService
        ? await this.waitEstimationService.estimate(reg, now)
        : {
            position:
              (await this.registrationsRepository.countWaitingBefore(reg)) + 1,
            estimatedWaitMinutes: null,
            method: 'unavailable',
            isReliable: false,
            calculatedAt: now,
          };

      return {
        ticketNumber: reg.ticket_number,
        status: 'waiting',
        registrationStatus: reg.status,
        position: estimate.position,
        estimatedWaitMinutes: estimate.estimatedWaitMinutes,
        estimationMethod: estimate.method,
        estimationReliable: estimate.isReliable,
        estimationCalculatedAt: estimate.calculatedAt,
        counterName: null,
        calledAt: null,
        queueId: reg.queue_id,
        queueName: reg.queue_name,
      };
    }

    return {
      ticketNumber: reg.ticket_number,
      status: reg.status,
      registrationStatus: reg.status,
      counterNumber: reg.thread_number,
      counterName: reg.counter_name,
      calledAt: reg.called_at,
      queueName: reg.queue_name,
    };
  }
}
