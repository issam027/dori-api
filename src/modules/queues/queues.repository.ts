import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';

export type QueueDetailRow = Record<string, any> & {
  queue_id: number;
  queue_code: string;
  site_id: number;
  queue_name: string;
  average_wait_time: number;
  thread_count: number;
  currency: string | null;
  locale: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class QueuesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createWithDefaultTier(
    siteId: number,
    dto: CreateQueueDto,
    userId: number,
    now: Date,
  ): Promise<number | null> {
    return this.dataSource.transaction(async (manager) => {
      const sites: Array<{ site_id: number }> = await manager.query(
        'SELECT site_id FROM dori_site WHERE site_id = $1 AND is_active = TRUE',
        [siteId],
      );
      if (!sites.length) return null;
      const rows: Array<{ queue_id: number }> = await manager.query(
        `INSERT INTO dori_site_queue_thread (
          queue_code, site_id, queue_name, average_wait_time, thread_count, currency,
          appointments_enabled, appointment_slot_duration, slot_capacity,
          working_hours_start, working_hours_end, break_start, break_end,
          late_tolerance_minutes, base_weight_walkin, base_weight_appointment,
          escalation_rate_walkin, escalation_rate_appointment, carry_over_waiting,
          daily_reset_mode, daily_reset_time, locale, created_by_user_id,
          updated_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, COALESCE($4, 10), COALESCE($5, 1), $6, $7, $8, $9,
          $10::time, $11::time, $12::time, $13::time, $14, $15, $16, $17,
          $18, $19, $20, $21::time, $22, $23, $23, $24, $24
        ) RETURNING queue_id`,
        [
          dto.queueCode,
          siteId,
          dto.queueName || null,
          dto.averageWaitTime ?? null,
          dto.threadCount ?? null,
          dto.currency ?? null,
          dto.appointmentsEnabled ?? null,
          dto.appointmentSlotDuration ?? null,
          dto.slotCapacity ?? null,
          dto.workingHoursStart || null,
          dto.workingHoursEnd || null,
          dto.breakStart || null,
          dto.breakEnd || null,
          dto.lateToleranceMinutes ?? null,
          dto.baseWeightWalkin ?? null,
          dto.baseWeightAppointment ?? null,
          dto.escalationRateWalkin ?? null,
          dto.escalationRateAppointment ?? null,
          dto.carryOverWaiting ?? null,
          dto.dailyResetMode || null,
          dto.dailyResetTime || null,
          dto.locale ?? null,
          userId,
          now,
        ],
      );
      const queueId = rows[0].queue_id;
      await manager.query(
        `INSERT INTO dori_queue_service_tier
          (queue_id, tier_id, price, currency, display_order, is_default,
           created_by_user_id, updated_by_user_id, created_at, updated_at)
         SELECT $1, tier_id, 0, NULL, 0, TRUE, $2, $2, $3, $3
         FROM dori_service_tier WHERE tier_code = 'free' LIMIT 1
         ON CONFLICT (queue_id, tier_id) DO NOTHING`,
        [queueId, userId, now],
      );
      return queueId;
    });
  }

  async findPage(input: {
    isActive?: boolean;
    siteId?: number;
    siteIds?: number[];
    queueIds?: number[];
    search?: string;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }): Promise<{ items: QueueDetailRow[]; total: number }> {
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (input.isActive !== undefined) {
      params.push(input.isActive);
      where += ` AND q.is_active = $${params.length}`;
    } else {
      where += ' AND q.is_active = TRUE';
    }
    if (input.siteId !== undefined) {
      params.push(input.siteId);
      where += ` AND q.site_id = $${params.length}`;
    } else if (input.siteIds) {
      params.push(input.siteIds);
      where += ` AND q.site_id = ANY($${params.length}::int[])`;
    } else if (input.queueIds) {
      params.push(input.queueIds);
      where += ` AND q.queue_id = ANY($${params.length}::int[])`;
    }
    if (input.search) {
      params.push(`%${input.search}%`);
      where += ` AND (q.queue_name ILIKE $${params.length} OR q.queue_code ILIKE $${params.length})`;
    }
    const from = `FROM dori_site_queue_thread q
      JOIN dori_site s ON s.site_id = q.site_id ${where}`;
    const counts: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const pageParams = [...params, input.pageSize, input.offset];
    const items: QueueDetailRow[] = await this.dataSource.query(
      `SELECT q.*, s.site_name, s.timezone, s.default_currency, s.default_locale,
              s.default_appointments_enabled, s.default_appointment_slot_duration,
              s.default_slot_capacity, s.default_working_hours_start,
              s.default_working_hours_end, s.default_break_start, s.default_break_end,
              s.default_late_tolerance_minutes, s.default_base_weight_walkin,
              s.default_base_weight_appointment, s.default_escalation_rate_walkin,
              s.default_escalation_rate_appointment, s.default_carry_over_waiting,
              s.default_daily_reset_mode, s.default_daily_reset_time
       ${from} ORDER BY ${input.sortField} ${input.sortOrder}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      pageParams,
    );
    return { items, total: counts[0]?.total ?? 0 };
  }

  async findActiveById(queueId: number): Promise<QueueDetailRow | null> {
    const rows: QueueDetailRow[] = await this.dataSource.query(
      `SELECT q.*, s.site_name, s.timezone AS site_timezone,
              s.default_currency, s.default_locale,
              s.default_appointments_enabled, s.default_appointment_slot_duration,
              s.default_slot_capacity, s.default_working_hours_start,
              s.default_working_hours_end, s.default_break_start, s.default_break_end,
              s.default_late_tolerance_minutes, s.default_base_weight_walkin,
              s.default_base_weight_appointment, s.default_escalation_rate_walkin,
              s.default_escalation_rate_appointment, s.default_carry_over_waiting,
              s.default_daily_reset_mode, s.default_daily_reset_time
       FROM dori_site_queue_thread q
       JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1 AND q.is_active = TRUE`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  async update(
    queueId: number,
    dto: UpdateQueueDto,
    userId: number,
    now: Date,
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown, cast?: string) => {
      if (value === undefined) return;
      values.push(value);
      fields.push(`${column} = $${values.length}${cast ?? ''}`);
    };
    add('queue_code', dto.queueCode);
    add('queue_name', dto.queueName);
    add('average_wait_time', dto.averageWaitTime);
    add('thread_count', dto.threadCount);
    add('currency', dto.currency);
    add('appointments_enabled', dto.appointmentsEnabled);
    add('appointment_slot_duration', dto.appointmentSlotDuration);
    add('slot_capacity', dto.slotCapacity);
    add('working_hours_start', dto.workingHoursStart, '::time');
    add('working_hours_end', dto.workingHoursEnd, '::time');
    add('break_start', dto.breakStart, '::time');
    add('break_end', dto.breakEnd, '::time');
    add('late_tolerance_minutes', dto.lateToleranceMinutes);
    add('base_weight_walkin', dto.baseWeightWalkin);
    add('base_weight_appointment', dto.baseWeightAppointment);
    add('escalation_rate_walkin', dto.escalationRateWalkin);
    add('escalation_rate_appointment', dto.escalationRateAppointment);
    add('carry_over_waiting', dto.carryOverWaiting);
    add('daily_reset_mode', dto.dailyResetMode);
    add('daily_reset_time', dto.dailyResetTime, '::time');
    add('locale', dto.locale);
    add('is_active', dto.isActive);
    add('updated_by_user_id', userId);
    add('updated_at', now);
    values.push(queueId);
    const rows: Array<{ queue_id: number }> = await this.dataSource.query(
      `UPDATE dori_site_queue_thread SET ${fields.join(', ')}
       WHERE queue_id = $${values.length} RETURNING queue_id`,
      values,
    );
    return rows.length > 0;
  }

  deactivate(queueId: number, userId: number, now: Date): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_site_queue_thread SET is_active = FALSE, deleted_at = $1,
         updated_by_user_id = $2, updated_at = $1 WHERE queue_id = $3`,
        [now, userId, queueId],
      );
      await manager.query(
        `UPDATE dori_queue_service_tier SET is_active = FALSE, deleted_at = $1,
         updated_by_user_id = $2, updated_at = $1
         WHERE queue_id = $3 AND is_active = TRUE`,
        [now, userId, queueId],
      );
      await manager.query(
        `UPDATE dori_queue_session SET disconnected_at = $1,
         closure_reason = 'forced', closed_by_user_id = $2
         WHERE queue_id = $3 AND disconnected_at IS NULL`,
        [now, userId, queueId],
      );
    });
  }

  async findOperationalContext(queueId: number): Promise<{
    average_wait_time: number;
    timezone: string;
    carry_over_waiting?: boolean | null;
    daily_reset_mode?: 'close_all' | 'close_served_only' | null;
    default_carry_over_waiting?: boolean;
    default_daily_reset_mode?: 'close_all' | 'close_served_only';
  } | null> {
    const rows: Array<{
      average_wait_time: number;
      timezone: string;
      carry_over_waiting: boolean | null;
      daily_reset_mode: 'close_all' | 'close_served_only' | null;
      default_carry_over_waiting: boolean;
      default_daily_reset_mode: 'close_all' | 'close_served_only';
    }> = await this.dataSource.query(
      `SELECT q.average_wait_time, q.carry_over_waiting, q.daily_reset_mode,
              s.timezone, s.default_carry_over_waiting, s.default_daily_reset_mode
       FROM dori_site_queue_thread q JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.queue_id = $1`,
      [queueId],
    );
    return rows[0] ?? null;
  }

  async getStatusSnapshot(queueId: number, businessDate: string) {
    const [waiting, active, appointments] = await Promise.all([
      this.dataSource.query<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM dori_registration
         WHERE queue_id = $1 AND business_date = $2::date
           AND status = 'waiting' AND is_active = TRUE`,
        [queueId, businessDate],
      ),
      this.dataSource.query<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM dori_queue_session
         WHERE queue_id = $1 AND disconnected_at IS NULL AND mode = 'active'`,
        [queueId],
      ),
      this.dataSource.query(
        `SELECT registration_id, ticket_number, scheduled_time, appointment_status, status
         FROM dori_registration WHERE queue_id = $1 AND business_date = $2::date
           AND entry_type = 'appointment' AND is_active = TRUE
           AND status IN ('booked', 'waiting') ORDER BY scheduled_time ASC LIMIT 5`,
        [queueId, businessDate],
      ),
    ]);
    return {
      waitingCount: waiting[0]?.count ?? 0,
      activeThreads: active[0]?.count ?? 0,
      nextAppointments: appointments,
    };
  }

  async getDisplaySnapshot(queueId: number, businessDate: string) {
    const [sessions, tickets] = await Promise.all([
      this.dataSource.query<
        Array<{ thread_number: number; ticket_number: string | null }>
      >(
        `SELECT qs.thread_number, c.ticket_number
         FROM dori_queue_session qs
         LEFT JOIN dori_registration c ON c.current_session_id = qs.session_id
           AND c.status = 'in_progress' AND c.is_active = TRUE
         WHERE qs.queue_id = $1 AND qs.disconnected_at IS NULL AND qs.mode = 'active'
         ORDER BY qs.thread_number ASC`,
        [queueId],
      ),
      this.dataSource.query<Array<{ ticket_number: string }>>(
        `SELECT ticket_number FROM dori_registration
         WHERE queue_id = $1 AND business_date = $2::date
           AND status = 'waiting' AND is_active = TRUE
         ORDER BY priority_reference_time ASC LIMIT 10`,
        [queueId, businessDate],
      ),
    ]);
    return {
      activeThreads: sessions.map((row) => ({
        threadNumber: row.thread_number,
        currentTicket: row.ticket_number || null,
      })),
      nextTickets: tickets.map((row) => row.ticket_number),
    };
  }

  reset(input: {
    queueId: number;
    userId: number;
    now: Date;
    businessDate: string;
    tomorrow: string;
    trackingValidUntil: Date;
    carryOver: boolean;
    resetMode: 'close_all' | 'close_served_only';
  }): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_queue_session SET disconnected_at = $1,
         closure_reason = 'daily_reset', closed_by_user_id = $2
         WHERE queue_id = $3 AND disconnected_at IS NULL`,
        [input.now, input.userId, input.queueId],
      );
      if (!input.carryOver) {
        await manager.query(
          `UPDATE dori_registration SET status = 'expired', closed_at = $1,
           is_active = FALSE, updated_at = $1 WHERE queue_id = $2
           AND business_date = $3::date AND status = 'waiting' AND is_active = TRUE`,
          [input.now, input.queueId, input.businessDate],
        );
      } else {
        await manager.query(
          `UPDATE dori_registration SET status = 'expired', closed_at = $1,
           is_active = FALSE, updated_at = $1 WHERE queue_id = $2
           AND business_date = $3::date AND status = 'waiting' AND is_active = TRUE
           AND ticket_number LIKE 'OLD-%'`,
          [input.now, input.queueId, input.businessDate],
        );
        await manager.query(
          `UPDATE dori_registration SET business_date = $1::date,
           carried_over_from_date = $2::date, ticket_number = 'OLD-' || ticket_number,
           registration_tracking_token_valid_until = $3, updated_at = $4
           WHERE queue_id = $5 AND business_date = $2::date AND status = 'waiting'
           AND is_active = TRUE AND ticket_number NOT LIKE 'OLD-%'`,
          [
            input.tomorrow,
            input.businessDate,
            input.trackingValidUntil,
            input.now,
            input.queueId,
          ],
        );
      }
      const status =
        input.resetMode === 'close_all'
          ? "status IN ('served', 'no_show', 'expired', 'cancelled')"
          : "status = 'served'";
      await manager.query(
        `UPDATE dori_registration SET is_active = FALSE, deleted_at = $1, updated_at = $1
         WHERE queue_id = $2 AND business_date = $3::date AND ${status} AND is_active = TRUE`,
        [input.now, input.queueId, input.businessDate],
      );
    });
  }

  async findOperatorPage(input: {
    queueId: number;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    pageSize: number;
    offset: number;
  }) {
    const from = `FROM dori_user_queue uq JOIN dori_user u ON u.user_id = uq.user_id
      WHERE uq.queue_id = $1 AND u.is_active = TRUE`;
    const count: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      [input.queueId],
    );
    const items = await this.dataSource.query(
      `SELECT u.user_id, u.username, u.email, u.user_type, uq.assigned_at ${from}
       ORDER BY ${input.sortField} ${input.sortOrder} LIMIT $2 OFFSET $3`,
      [input.queueId, input.pageSize, input.offset],
    );
    return { items, total: count[0]?.total ?? 0 };
  }

  async findQueueSiteId(queueId: number): Promise<number | null> {
    const rows = await this.dataSource.query(
      'SELECT site_id FROM dori_site_queue_thread WHERE queue_id = $1',
      [queueId],
    );
    return rows[0]?.site_id ?? null;
  }

  async findUserStatus(
    userId: number,
  ): Promise<{ user_id: number; is_active: boolean } | null> {
    const rows = await this.dataSource.query(
      'SELECT user_id, is_active FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL',
      [userId],
    );
    return rows[0] ?? null;
  }

  async hasOperatorRole(userId: number): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT ur.user_id FROM dori_user_role ur JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name IN ('hotesse', 'operator')
         AND r.is_active = TRUE LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  async assignOperator(
    queueId: number,
    userId: number,
    assignedBy: number,
    now: Date,
  ) {
    await this.dataSource.query(
      `INSERT INTO dori_user_queue (user_id, queue_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, queue_id) DO NOTHING`,
      [userId, queueId, now, assignedBy],
    );
  }

  async removeOperator(queueId: number, userId: number) {
    await this.dataSource.query(
      'DELETE FROM dori_user_queue WHERE user_id = $1 AND queue_id = $2',
      [userId, queueId],
    );
  }
}
