import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CreateRegistrationDto,
  RegistrationFilterDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';

export type RegistrationRow = Record<string, unknown> & {
  registration_id: number;
  queue_id: number;
  business_date: string;
  priority_reference_time: Date | string;
  registration_tracking_token_valid_until: Date | string;
  closed_at?: Date | string | null;
  status: string;
  average_wait_time: number;
  ticket_number: string;
};

export class RegistrationsTransaction {
  constructor(readonly manager: EntityManager) {}

  async findQueueConfig(queueId: number) {
    const rows = await this.manager.query(
      `SELECT q.*, s.timezone, s.default_currency,
       s.default_appointments_enabled, s.default_appointment_slot_duration, s.default_slot_capacity,
       s.default_working_hours_start, s.default_working_hours_end, s.default_break_start,
       s.default_break_end, s.default_late_tolerance_minutes
       FROM dori_site_queue_thread q JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1 AND q.is_active = TRUE`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  async personExistsInSite(personId: number, siteId: number) {
    const rows = await this.manager.query(
      `SELECT person_id FROM dori_person WHERE person_id = $1 AND site_id = $2
       AND is_active = TRUE AND deleted_at IS NULL`,
      [personId, siteId],
    );
    return rows.length > 0;
  }

  async findOfferedTier(queueId: number, tierId: number) {
    const rows = await this.manager.query(
      `SELECT qt.price, COALESCE(qt.currency, q.currency, s.default_currency) AS currency,
              t.tier_code, t.tier_name
       FROM dori_queue_service_tier qt
       JOIN dori_service_tier t ON t.tier_id = qt.tier_id
       JOIN dori_site_queue_thread q ON q.queue_id = qt.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE qt.queue_id = $1 AND qt.tier_id = $2 AND qt.is_active = TRUE`,
      [queueId, tierId],
    );
    return rows[0] ?? null;
  }

  async hasOpenRegistration(queueId: number, personId: number) {
    const rows = await this.manager.query(
      `SELECT registration_id FROM dori_registration WHERE queue_id = $1 AND person_id = $2
       AND status IN ('booked','waiting','in_progress') AND is_active = TRUE`,
      [queueId, personId],
    );
    return rows.length > 0;
  }

  async lockAndCountSlot(
    queueId: number,
    scheduledTime: Date,
    excludedId?: number,
  ) {
    await this.manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `appointment-slot:${queueId}:${scheduledTime.toISOString()}`,
    ]);
    const params: unknown[] = [queueId, scheduledTime];
    const exclusion =
      excludedId === undefined ? '' : ` AND registration_id <> $3`;
    if (excludedId !== undefined) params.push(excludedId);
    const rows = await this.manager.query(
      `SELECT COUNT(*)::int AS count FROM dori_registration
       WHERE queue_id = $1 AND scheduled_time = $2
       AND status IN ('booked','waiting','in_progress') AND is_active = TRUE${exclusion}`,
      params,
    );
    return rows[0]?.count ?? 0;
  }

  async nextTicketNumber(queueId: number, businessDate: string, now: Date) {
    const rows = await this.manager.query(
      `INSERT INTO dori_queue_counter (queue_id, business_date, last_number) VALUES ($1,$2,1)
       ON CONFLICT (queue_id,business_date) DO UPDATE SET
       last_number = dori_queue_counter.last_number + 1, updated_at = $3 RETURNING last_number`,
      [queueId, businessDate, now],
    );
    return Number(rows[0].last_number);
  }

  async hasTrackingRule(queueId: number, tierId: number) {
    const rows = await this.manager.query(
      `SELECT 1 FROM dori_tier_notification_rule WHERE queue_id = $1 AND tier_id = $2
       AND include_tracking_link = TRUE AND is_active = TRUE LIMIT 1`,
      [queueId, tierId],
    );
    return rows.length > 0;
  }

  async create(input: {
    dto: CreateRegistrationDto;
    personId: number;
    businessDate: string;
    ticketNumber: string;
    scheduledTime: Date | null;
    appointmentStatus: string;
    priorityReferenceTime: Date;
    status: string;
    tokenValidUntil: Date;
    userId: number;
    now: Date;
  }): Promise<RegistrationRow> {
    const rows = await this.manager.query(
      `INSERT INTO dori_registration (person_id,queue_id,tier_id,business_date,ticket_number,
       entry_type,scheduled_time,appointment_status,priority_reference_time,status,
       registration_tracking_token_valid_until,language_preference,created_by_user_id,
       updated_by_user_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$14) RETURNING *`,
      [
        input.personId,
        input.dto.queueId,
        input.dto.tierId,
        input.businessDate,
        input.ticketNumber,
        input.dto.entryType,
        input.scheduledTime,
        input.appointmentStatus,
        input.priorityReferenceTime,
        input.status,
        input.tokenValidUntil,
        input.dto.languagePreference ?? null,
        input.userId,
        input.now,
      ],
    );
    return rows[0];
  }

  async reschedule(
    registrationId: number,
    newTime: Date,
    businessDate: string,
    now: Date,
  ) {
    const rows = await this.manager.query(
      `UPDATE dori_registration SET scheduled_time=$1, priority_reference_time=$1, business_date=$2,
       appointment_status='rescheduled', status='booked', checked_in_at=NULL, updated_at=$3
       WHERE registration_id=$4 RETURNING *`,
      [newTime, businessDate, now, registrationId],
    );
    return rows[0];
  }
}

@Injectable()
export class RegistrationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  transaction<T>(
    work: (tx: RegistrationsTransaction) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work(new RegistrationsTransaction(manager)),
    );
  }

  async findAvailabilityConfig(queueId: number) {
    const rows = await this.dataSource.query(
      `SELECT q.*, s.timezone, s.default_appointments_enabled, s.default_appointment_slot_duration,
       s.default_slot_capacity, s.default_working_hours_start, s.default_working_hours_end,
       s.default_break_start, s.default_break_end FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id=q.site_id WHERE q.queue_id=$1 AND q.is_active=TRUE`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  findBookedSlots(queueId: number, businessDate: string) {
    return this.dataSource.query(
      `SELECT scheduled_time, COUNT(*)::int AS count FROM dori_registration
       WHERE queue_id=$1 AND business_date=$2 AND status IN ('booked','waiting','in_progress')
       AND is_active=TRUE GROUP BY scheduled_time`,
      [queueId, businessDate],
    );
  }

  async findForCheckIn(registrationId: number) {
    const rows = await this.dataSource.query(
      `SELECT r.*,q.late_tolerance_minutes,s.default_late_tolerance_minutes
       FROM dori_registration r JOIN dori_site_queue_thread q ON q.queue_id=r.queue_id
       JOIN dori_site s ON s.site_id=q.site_id WHERE r.registration_id=$1 AND r.is_active=TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  expire(registrationId: number, now: Date) {
    return this.dataSource.query(
      `UPDATE dori_registration SET status='expired',appointment_status='expired',closed_at=$1,
       is_active=FALSE,updated_at=$1 WHERE registration_id=$2`,
      [now, registrationId],
    );
  }

  async checkIn(registrationId: number, now: Date) {
    const rows = await this.dataSource.query(
      `UPDATE dori_registration SET status='waiting',appointment_status='checked_in',
       checked_in_at=$1,updated_at=$1 WHERE registration_id=$2 RETURNING *`,
      [now, registrationId],
    );
    return rows[0];
  }

  async findForReschedule(registrationId: number) {
    const rows = await this.dataSource.query(
      `SELECT r.*,q.slot_capacity,s.default_slot_capacity,s.timezone FROM dori_registration r
       JOIN dori_site_queue_thread q ON q.queue_id=r.queue_id JOIN dori_site s ON s.site_id=q.site_id
       WHERE r.registration_id=$1 AND r.is_active=TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async lookup(input: {
    queueIds?: number[];
    ticketNumber?: string;
    lastName?: string;
    scheduledTime?: Date;
  }) {
    const params: unknown[] = [];
    let where = 'r.is_active=TRUE';
    if (input.queueIds) {
      params.push(input.queueIds);
      where += ` AND r.queue_id=ANY($${params.length})`;
    }
    if (input.ticketNumber) {
      params.push(input.ticketNumber);
      where += ` AND r.ticket_number=$${params.length}`;
    } else {
      params.push(`%${input.lastName}%`);
      where += ` AND p.last_name ILIKE $${params.length}`;
      params.push(input.scheduledTime);
      where += ` AND r.scheduled_time=$${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number FROM dori_registration r
       JOIN dori_person p ON p.person_id=r.person_id WHERE ${where} LIMIT 1`,
      params,
    );
    return rows[0] ?? null;
  }

  async findPage(
    filter: RegistrationFilterDto,
    scopeQueueIds: number[] | undefined,
    sortField: string,
    sortOrder: 'ASC' | 'DESC',
    pageSize: number,
    offset: number,
  ) {
    const params: unknown[] = [];
    let where = 'r.is_active=TRUE';
    const add = (value: unknown, column: string) => {
      if (value !== undefined) {
        params.push(value);
        where += ` AND ${column}=$${params.length}`;
      }
    };
    add(filter.queueId, 'r.queue_id');
    add(filter.siteId, 'q.site_id');
    if (!filter.queueId && !filter.siteId && scopeQueueIds) {
      params.push(scopeQueueIds);
      where += ` AND r.queue_id=ANY($${params.length})`;
    }
    add(filter.businessDate, 'r.business_date');
    add(filter.status, 'r.status');
    add(filter.entryType, 'r.entry_type');
    add(filter.appointmentStatus, 'r.appointment_status');
    add(filter.personId, 'r.person_id');
    add(filter.tierId, 'r.tier_id');
    if (filter.search) {
      params.push(`%${filter.search}%`);
      where += ` AND (r.ticket_number ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR p.first_name ILIKE $${params.length})`;
    }
    const from = `FROM dori_registration r JOIN dori_person p ON p.person_id=r.person_id
      JOIN dori_site_queue_thread q ON q.queue_id=r.queue_id JOIN dori_service_tier t ON t.tier_id=r.tier_id WHERE ${where}`;
    const counts = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const items = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number,p.email,
      q.queue_name,q.queue_code,t.tier_code,t.tier_name ${from} ORDER BY r.${sortField} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findById(registrationId: number): Promise<RegistrationRow | null> {
    const rows = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number,p.email,
      q.queue_name,q.queue_code,t.tier_code,t.tier_name FROM dori_registration r
      JOIN dori_person p ON p.person_id=r.person_id JOIN dori_site_queue_thread q ON q.queue_id=r.queue_id
      JOIN dori_service_tier t ON t.tier_id=r.tier_id WHERE r.registration_id=$1 AND r.is_active=TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async isTierOffered(queueId: number, tierId: number) {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM dori_queue_service_tier WHERE queue_id=$1 AND tier_id=$2 AND is_active=TRUE`,
      [queueId, tierId],
    );
    return rows.length > 0;
  }

  async update(
    registrationId: number,
    dto: UpdateRegistrationDto,
    userId: number,
    now: Date,
  ) {
    const values: unknown[] = [];
    const fields: string[] = [];
    if (dto.tierId !== undefined) {
      values.push(dto.tierId);
      fields.push(`tier_id=$${values.length}`);
    }
    if (dto.languagePreference !== undefined) {
      values.push(dto.languagePreference);
      fields.push(`language_preference=$${values.length}`);
    }
    values.push(userId);
    fields.push(`updated_by_user_id=$${values.length}`);
    values.push(now);
    fields.push(`updated_at=$${values.length}`);
    values.push(registrationId);
    const rows = await this.dataSource.query(
      `UPDATE dori_registration SET ${fields.join(',')} WHERE registration_id=$${values.length} RETURNING *`,
      values,
    );
    return rows[0];
  }

  cancel(registrationId: number, userId: number, now: Date) {
    return this.dataSource.query(
      `UPDATE dori_registration SET status='cancelled',appointment_status=CASE WHEN entry_type='appointment'
     THEN 'cancelled' ELSE appointment_status END,closed_at=$1,is_active=FALSE,deleted_at=$1,
     updated_by_user_id=$2,updated_at=$1 WHERE registration_id=$3`,
      [now, userId, registrationId],
    );
  }

  async findByTrackingToken(token: string) {
    const rows = await this.dataSource.query(
      `SELECT r.*,q.average_wait_time FROM dori_registration r JOIN dori_site_queue_thread q ON q.queue_id=r.queue_id
     WHERE r.registration_tracking_token=$1`,
      [token],
    );
    return rows[0] ?? null;
  }

  async countWaitingBefore(row: RegistrationRow) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM dori_registration WHERE queue_id=$1 AND business_date=$2
     AND status='waiting' AND is_active=TRUE AND priority_reference_time<$3`,
      [row.queue_id, row.business_date, row.priority_reference_time],
    );
    return rows[0]?.count ?? 0;
  }

  async countActiveThreads(queueId: number) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM dori_queue_session WHERE queue_id=$1 AND disconnected_at IS NULL AND mode='active'`,
      [queueId],
    );
    return rows[0]?.count ?? 0;
  }
}
