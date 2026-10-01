import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateRegistrationDto,
  UpdateRegistrationDto,
  RescheduleDto,
  LookupRegistrationDto,
  RegistrationFilterDto,
  AvailabilityQueryDto,
} from './dto/registration.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PersonsService } from '../persons/persons.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly personsService: PersonsService,
  ) { }

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
    const now = this.clockService.now();

    // 1. Resolve Person
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
        user,
      );
      personId = createdPerson.person_id;
    } else {
      const personRows = await this.dataSource.query(
        `SELECT person_id FROM dori_person WHERE person_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [personId],
      );
      if (!personRows || personRows.length === 0) {
        throw new DoriException('PERSON_NOT_FOUND', { personId });
      }
    }

    // 2. Fetch Queue and Site Configuration
    const queueConfig = await this.dataSource.query(
      `SELECT q.*, s.timezone, s.default_currency,
              s.default_appointments_enabled, s.default_appointment_slot_duration, s.default_slot_capacity,
              s.default_working_hours_start, s.default_working_hours_end, s.default_break_start, s.default_break_end,
              s.default_late_tolerance_minutes
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1 AND q.is_active = TRUE`,
      [dto.queueId],
    );

    if (!queueConfig || queueConfig.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId: dto.queueId });
    }

    const q = queueConfig[0];
    const timezone = q.timezone || 'Africa/Tunis';
    const appointmentsEnabled =
      q.appointments_enabled ?? q.default_appointments_enabled ?? false;
    const slotCapacity = q.slot_capacity ?? q.default_slot_capacity ?? 1;

    // 3. Verify Tier Offered By Queue (§4.1, §6.5)
    const tierRows = await this.dataSource.query(
      `SELECT qt.price, qt.currency, t.tier_code, t.tier_name
       FROM dori_queue_service_tier qt
       JOIN dori_service_tier t ON t.tier_id = qt.tier_id
       WHERE qt.queue_id = $1 AND qt.tier_id = $2 AND qt.is_active = TRUE`,
      [dto.queueId, dto.tierId],
    );

    if (!tierRows || tierRows.length === 0) {
      throw new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
        tierId: dto.tierId,
        queueId: dto.queueId,
      });
    }

    const tierInfo = tierRows[0];

    // 4. Duplicate Check (§3.10, §6.9)
    const openRegs = await this.dataSource.query(
      `SELECT customer_id FROM dori_customer
       WHERE queue_id = $1 AND person_id = $2 AND status IN ('booked', 'waiting', 'in_progress') AND is_active = TRUE`,
      [dto.queueId, personId],
    );

    if (openRegs && openRegs.length > 0) {
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

      scheduledTime = new Date(dto.scheduledTime);
      businessDate = this.clockService.dateInTimezone(scheduledTime, timezone);
      appointmentStatus = 'booked';
      status = 'booked';
      priorityRefTime = scheduledTime;

      // Slot capacity check (§4.2, §6.5)
      const existingAppts = await this.dataSource.query(
        `SELECT COUNT(*)::int as count FROM dori_customer
         WHERE queue_id = $1 AND scheduled_time = $2 AND status IN ('booked', 'waiting', 'in_progress') AND is_active = TRUE`,
        [dto.queueId, scheduledTime],
      );

      const count = existingAppts[0]?.count || 0;
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
    const counterRes = await this.dataSource.query(
      `INSERT INTO dori_queue_counter (queue_id, business_date, last_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (queue_id, business_date)
       DO UPDATE SET last_number = dori_queue_counter.last_number + 1, updated_at = CURRENT_TIMESTAMP
       RETURNING last_number`,
      [dto.queueId, businessDate],
    );

    const lastNumber = counterRes[0].last_number;
    const ticketNumber = this.formatTicketNumber(q.queue_code, lastNumber);

    // End of business date for tracking token
    const tokenValidUntil = this.clockService.endOfDayInTimezone(
      businessDate,
      timezone,
    );

    // 7. Check if tier has includeTrackingLink rule
    const rules = await this.dataSource.query(
      `SELECT include_tracking_link FROM dori_tier_notification_rule
       WHERE queue_id = $1 AND tier_id = $2 AND include_tracking_link = TRUE AND is_active = TRUE LIMIT 1`,
      [dto.queueId, dto.tierId],
    );
    const hasTrackingRule = rules && rules.length > 0;

    // 8. Insert dori_customer
    const insertRes = await this.dataSource.query(
      `INSERT INTO dori_customer (
        person_id, queue_id, tier_id, business_date, ticket_number,
        entry_type, scheduled_time, appointment_status, priority_reference_time,
        status, registration_tracking_token_valid_until, language_preference,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $13, $14, $14
      ) RETURNING *`,
      [
        personId,
        dto.queueId,
        dto.tierId,
        businessDate,
        ticketNumber,
        dto.entryType,
        scheduledTime,
        appointmentStatus,
        priorityRefTime,
        status,
        tokenValidUntil,
        dto.languagePreference || null,
        user.userId,
        now,
      ],
    );

    const created = insertRes[0];
    const trackingUrl = hasTrackingRule
      ? `https://suivi.dori.tn/#${created.registration_tracking_token}`
      : null;

    return {
      registrationId: created.customer_id,
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
  }

  async getAvailability(
    queueId: number,
    queryDto: AvailabilityQueryDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);

    const queueConfig = await this.dataSource.query(
      `SELECT q.*, s.timezone,
              s.default_appointments_enabled, s.default_appointment_slot_duration, s.default_slot_capacity,
              s.default_working_hours_start, s.default_working_hours_end, s.default_break_start, s.default_break_end
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1 AND q.is_active = TRUE`,
      [queueId],
    );

    if (!queueConfig || queueConfig.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }

    const q = queueConfig[0];
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
    const slots: any[] = [];
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
    const bookedCounts = await this.dataSource.query(
      `SELECT scheduled_time, COUNT(*)::int as count
       FROM dori_customer
       WHERE queue_id = $1 AND business_date = $2 AND status IN ('booked', 'waiting', 'in_progress') AND is_active = TRUE
       GROUP BY scheduled_time`,
      [queueId, queryDto.date],
    );

    const bookingMap = new Map<string, number>();
    for (const b of bookedCounts) {
      if (b.scheduled_time) {
        bookingMap.set(new Date(b.scheduled_time).toISOString(), b.count);
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
      const slotIso = `${queryDto.date}T${timeStr}`;

      const booked = bookingMap.get(slotIso) || 0;
      const availableSpots = Math.max(0, slotCapacity - booked);

      slots.push({
        time: slotIso,
        slotCapacity,
        bookedCount: booked,
        availableSpots,
        isAvailable: availableSpots > 0,
      });

      currentMinutes += slotDuration;
    }

    const { pageSize, offset } = queryDto.getParams();
    const paginatedSlots = slots.slice(offset, offset + pageSize);
    return queryDto.createResponse(paginatedSlots, slots.length);
  }

  async checkIn(registrationId: number, user: AuthenticatedUser) {
    const regs = await this.dataSource.query(
      `SELECT c.*, q.late_tolerance_minutes, s.default_late_tolerance_minutes
       FROM dori_customer c
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE c.customer_id = $1 AND c.is_active = TRUE`,
      [registrationId],
    );

    if (!regs || regs.length === 0) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    const reg = regs[0];
    await this.scopeService.checkQueueAccess(user, reg.queue_id);

    if (reg.entry_type !== 'appointment' || reg.status !== 'booked') {
      throw new DoriException('REGISTRATION_CLOSED');
    }

    const now = this.clockService.now();
    const tolerance =
      reg.late_tolerance_minutes ?? reg.default_late_tolerance_minutes ?? 60;
    const scheduledTime = new Date(reg.scheduled_time);
    const deadline = new Date(scheduledTime.getTime() + tolerance * 60 * 1000);

    // Late arrival beyond tolerance -> expired (§4.3)
    if (now > deadline) {
      await this.dataSource.query(
        `UPDATE dori_customer
         SET status = 'expired', appointment_status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
         WHERE customer_id = $2`,
        [now, registrationId],
      );
      throw new DoriException('APPOINTMENT_EXPIRED');
    }

    const updated = await this.dataSource.query(
      `UPDATE dori_customer
       SET status = 'waiting', appointment_status = 'checked_in', checked_in_at = $1, updated_at = $1
       WHERE customer_id = $2
       RETURNING *`,
      [now, registrationId],
    );

    return updated[0];
  }

  async reschedule(
    registrationId: number,
    dto: RescheduleDto,
    user: AuthenticatedUser,
  ) {
    const regs = await this.dataSource.query(
      `SELECT c.*, q.slot_capacity, s.default_slot_capacity, s.timezone
       FROM dori_customer c
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE c.customer_id = $1 AND c.is_active = TRUE`,
      [registrationId],
    );

    if (!regs || regs.length === 0) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    const reg = regs[0];
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

    const newTime = new Date(dto.scheduledTime);
    const slotCapacity = reg.slot_capacity ?? reg.default_slot_capacity ?? 1;

    // Check slot capacity on target slot (§6.6)
    const existing = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM dori_customer
       WHERE queue_id = $1 AND scheduled_time = $2 AND status IN ('booked', 'waiting', 'in_progress') AND is_active = TRUE
         AND customer_id <> $3`,
      [reg.queue_id, newTime, registrationId],
    );

    if ((existing[0]?.count || 0) >= slotCapacity) {
      throw new DoriException('APPOINTMENT_SLOT_FULL', {
        scheduledTime: dto.scheduledTime,
      });
    }

    const timezone = reg.timezone || 'Africa/Tunis';
    const newBusinessDate = this.clockService.dateInTimezone(newTime, timezone);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `UPDATE dori_customer
       SET scheduled_time = $1, priority_reference_time = $1, business_date = $2,
           appointment_status = 'rescheduled', status = 'booked', checked_in_at = NULL, updated_at = $3
       WHERE customer_id = $4
       RETURNING *`,
      [newTime, newBusinessDate, now, registrationId],
    );

    const updated = res[0];
    return {
      registrationId: updated.customer_id,
      appointmentStatus: updated.appointment_status,
      status: updated.status,
      scheduledTime: updated.scheduled_time,
      priorityReferenceTime: updated.priority_reference_time,
    };
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

    let query = `
      SELECT c.*, p.first_name, p.last_name, p.phone_number
      FROM dori_customer c
      JOIN dori_person p ON p.person_id = c.person_id
      JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
      JOIN dori_site s ON s.site_id = q.site_id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) {
        throw new DoriException('REGISTRATION_NOT_FOUND');
      }
      params.push(scope.queueIds);
      query += ` AND c.queue_id = ANY($${params.length})`;
    }

    if (dto.ticketNumber) {
      params.push(dto.ticketNumber);
      query += ` AND c.ticket_number = $${params.length}`;
    } else {
      params.push(`%${dto.lastName}%`);
      query += ` AND p.last_name ILIKE $${params.length}`;
      params.push(new Date(dto.scheduledTime!));
      query += ` AND c.scheduled_time = $${params.length}`;
    }

    const rows = await this.dataSource.query(`${query} LIMIT 1`, params);
    if (!rows || rows.length === 0) {
      throw new DoriException('REGISTRATION_NOT_FOUND');
    }

    return rows[0];
  }

  async findRegistrations(
    filter: RegistrationFilterDto,
    user: AuthenticatedUser,
  ) {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      ['customer_id', 'ticket_number', 'business_date', 'status', 'scheduled_time', 'created_at', 'priority_reference_time'],
      'customer_id',
    );

    let query = `
      SELECT c.*, p.first_name, p.last_name, p.phone_number, p.email,
             q.queue_name, q.queue_code, t.tier_code, t.tier_name
      FROM dori_customer c
      JOIN dori_person p ON p.person_id = c.person_id
      JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
      JOIN dori_service_tier t ON t.tier_id = c.tier_id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];

    if (filter.queueId) {
      await this.scopeService.checkQueueAccess(user, filter.queueId);
      params.push(filter.queueId);
      query += ` AND c.queue_id = $${params.length}`;
    } else if (filter.siteId) {
      await this.scopeService.checkSiteAccess(user, filter.siteId);
      params.push(filter.siteId);
      query += ` AND q.site_id = $${params.length}`;
    } else if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) return filter.createResponse([], 0);
      params.push(scope.queueIds);
      query += ` AND c.queue_id = ANY($${params.length})`;
    }

    if (filter.businessDate) {
      params.push(filter.businessDate);
      query += ` AND c.business_date = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      query += ` AND c.status = $${params.length}`;
    }
    if (filter.entryType) {
      params.push(filter.entryType);
      query += ` AND c.entry_type = $${params.length}`;
    }
    if (filter.appointmentStatus) {
      params.push(filter.appointmentStatus);
      query += ` AND c.appointment_status = $${params.length}`;
    }
    if (filter.personId) {
      params.push(filter.personId);
      query += ` AND c.person_id = $${params.length}`;
    }
    if (filter.tierId) {
      params.push(filter.tierId);
      query += ` AND c.tier_id = $${params.length}`;
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const pIdx = params.length;
      query += ` AND (c.ticket_number ILIKE $${pIdx} OR p.last_name ILIKE $${pIdx} OR p.first_name ILIKE $${pIdx})`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q_count`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY c.${safeSortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async findRegistrationById(registrationId: number, user: AuthenticatedUser) {
    const rows = await this.dataSource.query(
      `SELECT c.*, p.first_name, p.last_name, p.phone_number, p.email,
              q.queue_name, q.queue_code, t.tier_code, t.tier_name
       FROM dori_customer c
       JOIN dori_person p ON p.person_id = c.person_id
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       JOIN dori_service_tier t ON t.tier_id = c.tier_id
       WHERE c.customer_id = $1 AND c.is_active = TRUE`,
      [registrationId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('REGISTRATION_NOT_FOUND', { registrationId });
    }

    const reg = rows[0];
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

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.tierId !== undefined) {
      // Check if offered
      const offered = await this.dataSource.query(
        `SELECT 1 FROM dori_queue_service_tier WHERE queue_id = $1 AND tier_id = $2 AND is_active = TRUE`,
        [reg.queue_id, dto.tierId],
      );
      if (!offered || offered.length === 0) {
        throw new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
          tierId: dto.tierId,
          queueId: reg.queue_id,
        });
      }
      fields.push(`tier_id = $${idx++}`);
      values.push(dto.tierId);
    }

    if (dto.languagePreference !== undefined) {
      fields.push(`language_preference = $${idx++}`);
      values.push(dto.languagePreference);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(registrationId);

    const res = await this.dataSource.query(
      `UPDATE dori_customer SET ${fields.join(', ')} WHERE customer_id = $${idx} RETURNING *`,
      values,
    );

    return res[0];
  }

  async cancelRegistration(registrationId: number, user: AuthenticatedUser) {
    await this.findRegistrationById(registrationId, user);
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_customer
       SET status = 'cancelled',
           appointment_status = CASE WHEN entry_type = 'appointment' THEN 'cancelled' ELSE appointment_status END,
           closed_at = $1, is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE customer_id = $3`,
      [now, user.userId, registrationId],
    );

    return { registrationId, cancelled: true };
  }

  // Public Tracking Endpoint (§4.14, §6.8)
  async getPublicPosition(trackingToken: string) {
    if (!trackingToken) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const now = this.clockService.now();
    const rows = await this.dataSource.query(
      `SELECT c.*, q.average_wait_time
       FROM dori_customer c
       JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
       WHERE c.registration_tracking_token = $1`,
      [trackingToken],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('TOKEN_EXPIRED');
    }

    const reg = rows[0];

    // Check token expiration date (§4.14)
    if (new Date(reg.registration_tracking_token_valid_until) < now) {
      throw new DoriException('TOKEN_EXPIRED');
    }

    // Degraded response if finished > 60 minutes (§4.14, §6.8)
    if (
      reg.closed_at &&
      now.getTime() - new Date(reg.closed_at).getTime() > 60 * 60 * 1000
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
      const countBefore = await this.dataSource.query(
        `SELECT COUNT(*)::int as count FROM dori_customer
         WHERE queue_id = $1 AND business_date = $2 AND status = 'waiting' AND is_active = TRUE
           AND priority_reference_time < $3`,
        [reg.queue_id, reg.business_date, reg.priority_reference_time],
      );
      const position = (countBefore[0]?.count || 0) + 1;

      // Count active threads
      const activeThreadsRes = await this.dataSource.query(
        `SELECT COUNT(*)::int as count FROM dori_queue_session
         WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
        [reg.queue_id],
      );
      const activeThreads = Math.max(1, activeThreadsRes[0]?.count || 1);
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
