import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CreateRegistrationDto,
  RegistrationFilterDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';

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
  called_at: Date | string | null;
  counter_name: string | null;
  thread_number: number | null;
  queue_name: string;
};

export class RegistrationsTransaction {
  constructor(readonly manager: EntityManager) {}

  async findQueueConfig(queueId: number) {
    const rows = await this.manager.query(
      `SELECT q.*, s.timezone, s.default_currency,
       s.default_appointments_enabled, s.default_appointment_slot_duration, s.default_slot_capacity,
       s.default_working_hours_start, s.default_working_hours_end, s.default_break_start,
       s.default_break_end, s.default_late_tolerance_minutes
       FROM dori_queue q JOIN dori_site s ON s.site_id = q.site_id
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
       JOIN dori_queue q ON q.queue_id = qt.queue_id
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
       AND status NOT IN ('cancelled') AND is_active = TRUE${exclusion}`,
      params,
    );
    return rows[0]?.count ?? 0;
  }

  async nextTicketNumber(queueId: number, businessDate: string, now: Date) {
    const rows = await this.manager.query(
      `INSERT INTO dori_queue_daily_ticket_counter (queue_id, business_date, last_number) VALUES ($1,$2,1)
       ON CONFLICT (queue_id,business_date) DO UPDATE SET
       last_number = dori_queue_daily_ticket_counter.last_number + 1, updated_at = $3 RETURNING last_number`,
      [queueId, businessDate, now],
    );
    return Number(rows[0].last_number);
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

  async createWelcomeNotifications(input: {
    registrationId: number;
    trackingToken: string;
    ticketNumber: string;
    now: Date;
    templateService: NotificationTemplateService;
  }): Promise<number> {
    const rules: Array<{
      rule_id: number;
      channel: 'sms' | 'email';
      include_tracking_link: boolean;
      locale: string;
      first_name: string | null;
      phone_number: string | null;
      email: string | null;
    }> = await this.manager.query(
      `SELECT nr.rule_id, nr.channel, nr.include_tracking_link,
              COALESCE(r.language_preference, p.language_preference, s.default_locale, 'fr') AS locale,
              p.first_name, p.phone_number, p.email
       FROM dori_registration r
       JOIN dori_person p ON p.person_id = r.person_id
       JOIN dori_queue q ON q.queue_id = r.queue_id
       JOIN dori_site s ON s.site_id = q.site_id
       JOIN dori_queue_tier_notification_rule nr
         ON nr.queue_id = r.queue_id AND nr.tier_id = r.tier_id
       WHERE r.registration_id = $1
         AND nr.notification_type = 'welcome'
         AND nr.is_active = TRUE`,
      [input.registrationId],
    );
    if (!rules.length) return 0;

    const templateKeys = rules.map((rule) =>
      input.templateService.templateKey(
        rule.channel,
        'welcome',
        rule.include_tracking_link,
      ),
    );
    const locales = [...new Set([...rules.map((rule) => rule.locale), 'fr'])];
    const translations: Array<{
      translation_key: string;
      locale: string;
      content: string;
    }> = await this.manager.query(
      `SELECT translation_key, locale, content FROM dori_translation
       WHERE translation_key = ANY($1) AND locale = ANY($2) AND is_active = TRUE`,
      [templateKeys, locales],
    );
    const translationMap = new Map(
      translations.map((row) => [
        `${row.translation_key}:${row.locale}`,
        row.content,
      ]),
    );
    const trackingUrl = input.templateService.buildTrackingUrl(
      input.trackingToken,
    );
    const notifications = rules.map((rule) => {
      const templateKey = input.templateService.templateKey(
        rule.channel,
        'welcome',
        rule.include_tracking_link,
      );
      const template =
        translationMap.get(`${templateKey}:${rule.locale}`) ??
        translationMap.get(`${templateKey}:fr`);
      const recipient = rule.channel === 'sms' ? rule.phone_number : rule.email;
      const rendered = template
        ? input.templateService.render(template, {
            ticket: input.ticketNumber,
            firstName: rule.first_name ?? '',
            trackingUrl,
          })
        : { content: null, failureReason: `TEMPLATE_NOT_FOUND:${templateKey}` };
      const failureReason =
        (!recipient ? `RECIPIENT_MISSING:${rule.channel}` : null) ??
        rendered.failureReason;
      return {
        registrationId: input.registrationId,
        ruleId: rule.rule_id,
        channel: rule.channel,
        locale: rule.locale,
        recipient,
        content: rendered.content,
        status: failureReason ? 'failed' : 'pending',
        failureReason,
      };
    });
    const inserted: Array<{ notification_id: number }> =
      await this.manager.query(
        `INSERT INTO dori_notification (
           registration_id, rule_id, channel, notification_type, locale, recipient,
           notification_content, notification_status, failure_reason,
           attempt_count, created_at, updated_at
         )
         SELECT x.registration_id, x.rule_id, x.channel, 'welcome', x.locale,
                x.recipient, x.content, x.status, x.failure_reason, 0, $2, $2
         FROM jsonb_to_recordset($1::jsonb) AS x(
           registration_id int, rule_id int, channel varchar, locale varchar,
           recipient varchar, content text, status varchar, failure_reason text
         )
         ON CONFLICT (registration_id, notification_type, channel) DO NOTHING
         RETURNING notification_id`,
        [
          JSON.stringify(
            notifications.map((notification) => ({
              registration_id: notification.registrationId,
              rule_id: notification.ruleId,
              channel: notification.channel,
              locale: notification.locale,
              recipient: notification.recipient,
              content: notification.content,
              status: notification.status,
              failure_reason: notification.failureReason,
            })),
          ),
          input.now,
        ],
      );
    return inserted.length;
  }

  async reschedule(
    registrationId: number,
    newTime: Date,
    businessDate: string,
    ticketNumber: string | undefined,
    now: Date,
  ) {
    const rows = await this.manager.query(
      `UPDATE dori_registration SET scheduled_time=$1, priority_reference_time=$1, business_date=$2,
       ticket_number=COALESCE($3, ticket_number), appointment_status='rescheduled', status='booked',
       checked_in_at=NULL, updated_at=$4 WHERE registration_id=$5 RETURNING *`,
      [newTime, businessDate, ticketNumber ?? null, now, registrationId],
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
       s.default_break_start, s.default_break_end FROM dori_queue q
       JOIN dori_site s ON s.site_id=q.site_id WHERE q.queue_id=$1 AND q.is_active=TRUE`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  findBookedSlotsBetween(queueId: number, dateFrom: string, dateTo: string) {
    return this.dataSource.query(
      `SELECT business_date::text AS business_date, scheduled_time, COUNT(*)::int AS count FROM dori_registration
       WHERE queue_id=$1
         AND entry_type='appointment'
         AND scheduled_time IS NOT NULL
         AND business_date BETWEEN $2 AND $3
         AND status NOT IN ('cancelled')
         AND is_active=TRUE
       GROUP BY business_date, scheduled_time`,
      [queueId, dateFrom, dateTo],
    );
  }

  async findSiteTimezone(siteId: number): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT timezone FROM dori_site WHERE site_id=$1`,
      [siteId],
    );
    return rows[0]?.timezone ?? null;
  }

  async findForCheckIn(registrationId: number) {
    const rows = await this.dataSource.query(
      `SELECT r.*,q.late_tolerance_minutes,s.default_late_tolerance_minutes
       FROM dori_registration r JOIN dori_queue q ON q.queue_id=r.queue_id
       JOIN dori_site s ON s.site_id=q.site_id WHERE r.registration_id=$1 AND r.is_active=TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  expire(registrationId: number, now: Date) {
    return this.dataSource.query(
      `UPDATE dori_registration SET status='expired',appointment_status='expired',closed_at=$1,
       updated_at=$1 WHERE registration_id=$2`,
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
      `SELECT r.*,r.business_date::text AS business_date,q.queue_code,q.slot_capacity,
       s.default_slot_capacity,s.timezone FROM dori_registration r
       JOIN dori_queue q ON q.queue_id=r.queue_id JOIN dori_site s ON s.site_id=q.site_id
       WHERE r.registration_id=$1 AND r.is_active=TRUE`,
      [registrationId],
    );
    return rows[0] ?? null;
  }

  async lookup(input: {
    queueIds?: number[];
    phoneNumber?: string;
    lastName?: string;
    scheduledTime?: Date;
    now: Date;
  }) {
    const params: unknown[] = [];
    let where = `r.is_active=TRUE
      AND r.entry_type='appointment'
      AND r.status='booked'
      AND r.appointment_status IN ('booked','rescheduled')`;
    if (input.queueIds) {
      params.push(input.queueIds);
      where += ` AND r.queue_id=ANY($${params.length})`;
    }
    if (input.phoneNumber) {
      params.push(input.phoneNumber);
      where += ` AND p.phone_number=$${params.length}`;
      params.push(input.now);
      where += ` AND r.business_date=($${params.length}::timestamptz AT TIME ZONE s.timezone)::date`;
    } else {
      params.push(input.lastName);
      where += ` AND LOWER(p.last_name)=LOWER($${params.length})`;
      params.push(input.scheduledTime);
      where += ` AND r.scheduled_time=$${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number,
       (SELECT COUNT(*)::int FROM dori_person_note pn
        WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
       FROM dori_registration r
       JOIN dori_person p ON p.person_id=r.person_id
       JOIN dori_queue q ON q.queue_id=r.queue_id
       JOIN dori_site s ON s.site_id=q.site_id
       WHERE ${where} ORDER BY r.scheduled_time ASC, r.registration_id ASC LIMIT 1`,
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
    scheduledBounds?: { fromInclusive: Date; toExclusive: Date },
  ) {
    const params: unknown[] = [];
    const activeFilter = filter.isActive ?? true;
    params.push(activeFilter);
    let where = `r.is_active=$${params.length}`;
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
    if (scheduledBounds) {
      params.push(scheduledBounds.fromInclusive);
      where += ` AND r.scheduled_time >= $${params.length}`;
      params.push(scheduledBounds.toExclusive);
      where += ` AND r.scheduled_time < $${params.length}`;
    }
    add(filter.status, 'r.status');
    add(filter.entryType, 'r.entry_type');
    add(filter.appointmentStatus, 'r.appointment_status');
    add(filter.personId, 'r.person_id');
    add(filter.servedByUserId, 'r.served_by_user_id');
    add(filter.tierId, 'r.tier_id');
    if (filter.search) {
      params.push(`%${filter.search}%`);
      where += ` AND (r.ticket_number ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR p.first_name ILIKE $${params.length})`;
    }
    const from = `FROM dori_registration r JOIN dori_person p ON p.person_id=r.person_id
      JOIN dori_queue q ON q.queue_id=r.queue_id JOIN dori_service_tier t ON t.tier_id=r.tier_id
      WHERE ${where}`;
    const counts = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const items = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number,p.email,
      q.queue_name,q.queue_code,t.tier_code,t.tier_name,
      (SELECT COUNT(*)::int FROM dori_person_note pn
       WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
      ${from} ORDER BY r.${sortField} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findById(registrationId: number): Promise<RegistrationRow | null> {
    const rows = await this.dataSource.query(
      `SELECT r.*,p.first_name,p.last_name,p.phone_number,p.email,
      q.queue_name,q.queue_code,t.tier_code,t.tier_name,
      (SELECT COUNT(*)::int FROM dori_person_note pn
       WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
      FROM dori_registration r
      JOIN dori_person p ON p.person_id=r.person_id JOIN dori_queue q ON q.queue_id=r.queue_id
      JOIN dori_service_tier t ON t.tier_id=r.tier_id
      WHERE r.registration_id=$1`,
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
    if (dto.isActive !== undefined) {
      values.push(dto.isActive);
      fields.push(`is_active=$${values.length}`);
      values.push(dto.isActive ? null : now);
      fields.push(`deleted_at=$${values.length}`);
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
     THEN 'cancelled' ELSE appointment_status END,closed_at=$1,
     updated_by_user_id=$2,updated_at=$1 WHERE registration_id=$3`,
      [now, userId, registrationId],
    );
  }

  async findByTrackingToken(token: string) {
    const rows = await this.dataSource.query(
      `SELECT r.*, q.average_wait_time, q.queue_name,
              os.thread_number, os.counter_name
       FROM dori_registration r
       JOIN dori_queue q ON q.queue_id = r.queue_id
       LEFT JOIN dori_operator_session os
         ON os.session_id = r.served_by_session_id
       WHERE r.registration_tracking_token = $1`,
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
      `SELECT COUNT(*)::int AS count FROM dori_operator_session WHERE queue_id=$1 AND disconnected_at IS NULL AND mode='active'`,
      [queueId],
    );
    return rows[0]?.count ?? 0;
  }
}
