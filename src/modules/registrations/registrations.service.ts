import { Injectable } from '@nestjs/common';
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

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly registrationsRepository: RegistrationsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly personsService: PersonsService,
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
    return this.registrationsRepository.transaction(async (tx) => {
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
      const tokenValidUntil = this.clockService.endOfDayInTimezone(
        businessDate,
        timezone,
      );

      // 7. Check if tier has includeTrackingLink rule
      const hasTrackingRule = await tx.hasTrackingRule(dto.queueId, dto.tierId);

      // 8. Insert dori_registration
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
      const trackingUrl = hasTrackingRule
        ? `https://suivi.dori.tn/#${created.registration_tracking_token}`
        : null;

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
        trackingUrl,
        registrationTrackingTokenValidUntil: hasTrackingRule
          ? tokenValidUntil
          : null,
      };
    });
  }

  async getAvailability(
    queueId: number,
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

    // Generate slots
    const slots: SlotAvailabilityItemDto[] = [];
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
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
    const bookedCounts = await this.registrationsRepository.findBookedSlots(
      queueId,
      queryDto.date,
    );

    const bookingMap = new Map<string, number>();
    for (const b of bookedCounts) {
      if (b.scheduled_time) {
        bookingMap.set(
          this.clockService.parse(b.scheduled_time).toISOString(),
          b.count,
        );
      }
    }

    while (currentMinutes + slotDuration <= endMinutes) {
      // Check break
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
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      const slotIso = this.clockService
        .fromZonedTime(`${queryDto.date}T${timeStr}`, q.timezone)
        .toISOString();

      const booked = bookingMap.get(slotIso) || 0;
      const availableSpots = Math.max(0, slotCapacity - booked);

      slots.push({
        time: slotIso,
        capacity: slotCapacity,
        booked,
        available: availableSpots,
        isAvailable: availableSpots > 0,
      });

      currentMinutes += slotDuration;
    }

    return { queueId, date: queryDto.date, slots };
  }

  async checkIn(registrationId: number, user: AuthenticatedUser) {
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

    return this.registrationsRepository.checkIn(registrationId, now);
  }

  async reschedule(
    registrationId: number,
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
      const updated = await tx.reschedule(
        registrationId,
        newTime,
        newBusinessDate,
        now,
      );
      return {
        registrationId: updated.registration_id,
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

    // Kiosk lookup restricted to today and assigned queues (§5.7, §11.6.3)
    if (!dto.ticketNumber && (!dto.lastName || !dto.scheduledTime)) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['Provide ticketNumber OR (lastName and scheduledTime)'] },
      );
    }

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) {
        throw new DoriException('REGISTRATION_NOT_FOUND');
      }
    }
    const registration = await this.registrationsRepository.lookup({
      queueIds: scope.isGlobal ? undefined : scope.queueIds,
      ticketNumber: dto.ticketNumber,
      lastName: dto.lastName,
      scheduledTime: dto.scheduledTime
        ? this.clockService.parse(dto.scheduledTime)
        : undefined,
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
    const result = await this.registrationsRepository.findPage(
      filter,
      scope.isGlobal || filter.queueId || filter.siteId
        ? undefined
        : scope.queueIds,
      safeSortField,
      sortOrder,
      pageSize,
      offset,
    );
    return filter.createResponse<RegistrationResponseDto>(
      result.items as RegistrationResponseDto[],
      result.total,
    );
  }

  async findRegistrationById(registrationId: number, user: AuthenticatedUser) {
    const reg = await this.registrationsRepository.findById(registrationId);
    if (!reg) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    await this.scopeService.checkQueueAccess(user, reg.queue_id);
    return reg;
  }

  async updateRegistration(
    registrationId: number,
    dto: UpdateRegistrationDto,
    user: AuthenticatedUser,
  ) {
    const reg = await this.findRegistrationById(registrationId, user);
    const now = this.clockService.now();

    if (['served', 'no_show', 'expired', 'cancelled'].includes(reg.status)) {
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
    return this.registrationsRepository.update(
      registrationId,
      dto,
      user.userId,
      now,
    );
  }

  async cancelRegistration(registrationId: number, user: AuthenticatedUser) {
    await this.findRegistrationById(registrationId, user);
    const now = this.clockService.now();

    await this.registrationsRepository.cancel(registrationId, user.userId, now);

    return { registrationId, cancelled: true };
  }

  // Public Tracking Endpoint (§4.14, §6.8)
  async getPublicPosition(trackingToken: string) {
    if (!trackingToken) {
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
        60 * 60 * 1000
    ) {
      return { status: 'closed' };
    }

    if (reg.status === 'in_progress') {
      return {
        ticketNumber: reg.ticket_number,
        status: 'in_progress',
        position: 0,
        estimatedWaitMinutes: 0,
      };
    }

    if (reg.status === 'waiting') {
      // Calculate position among waiting clients on the same queue and business day
      const position =
        (await this.registrationsRepository.countWaitingBefore(reg)) + 1;

      // Count active threads
      const activeThreads = Math.max(
        1,
        await this.registrationsRepository.countActiveThreads(reg.queue_id),
      );
      const estimatedWaitMinutes = Math.round(
        (position * reg.average_wait_time) / activeThreads,
      );

      return {
        ticketNumber: reg.ticket_number,
        status: 'waiting',
        position,
        estimatedWaitMinutes,
      };
    }

    return {
      ticketNumber: reg.ticket_number,
      status: reg.status,
    };
  }
}
