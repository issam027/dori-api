import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import {
  SiteResponseDto,
  SiteManagerResponseDto,
} from './dto/site-response.dto';

interface CountRow {
  total: number;
}

interface UserStatusRow {
  user_id: number;
  is_active: boolean;
}

@Injectable()
export class SitesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findActive(
    siteIds: number[] | null,
    sortField: string,
    sortOrder: 'ASC' | 'DESC',
    pageSize: number,
    offset: number,
  ): Promise<{ items: SiteResponseDto[]; total: number }> {
    let filter = 'WHERE is_active = TRUE';
    const params: unknown[] = [];
    if (siteIds) {
      params.push(siteIds);
      filter += ` AND site_id = ANY($${params.length})`;
    }
    const [count] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*)::int AS total FROM dori_site ${filter}`,
      params,
    );
    const items = await this.dataSource.query<SiteResponseDto[]>(
      `SELECT * FROM dori_site ${filter}
       ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      params,
    );
    return { items, total: count?.total ?? 0 };
  }

  async create(
    dto: CreateSiteDto,
    userId: number,
    now: Date,
  ): Promise<SiteResponseDto> {
    const rows = await this.dataSource.query<SiteResponseDto[]>(
      `INSERT INTO dori_site (
        site_name, site_location, site_logo_url, site_type, timezone, default_currency,
        default_appointments_enabled, default_appointment_slot_duration, default_slot_capacity,
        default_working_hours_start, default_working_hours_end, default_break_start, default_break_end,
        default_late_tolerance_minutes, default_base_weight_walkin, default_base_weight_appointment,
        default_escalation_rate_walkin, default_escalation_rate_appointment, default_carry_over_waiting,
        default_daily_reset_mode, default_daily_reset_time, default_locale, created_by_user_id, updated_by_user_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, COALESCE($4, 'public'), COALESCE($5, 'Africa/Tunis'), COALESCE($6, 'TND'),
        COALESCE($7, FALSE), COALESCE($8, 15), COALESCE($9, 1),
        COALESCE($10, '08:00'), COALESCE($11, '17:00'), COALESCE($12, '12:00'), COALESCE($13, '14:00'),
        COALESCE($14, 60), COALESCE($15, 0), COALESCE($16, 60), COALESCE($17, 1), COALESCE($18, 1),
        COALESCE($19, FALSE), COALESCE($20, 'close_all'), COALESCE($21, '03:00'), COALESCE($22, 'fr'),
        $23, $23, $24, $24
      ) RETURNING *`,
      [
        dto.siteName,
        dto.siteLocation || null,
        dto.siteLogoUrl || null,
        dto.siteType || null,
        dto.timezone || null,
        dto.defaultCurrency || null,
        dto.defaultAppointmentsEnabled ?? null,
        dto.defaultAppointmentSlotDuration ?? null,
        dto.defaultSlotCapacity ?? null,
        dto.defaultWorkingHoursStart || null,
        dto.defaultWorkingHoursEnd || null,
        dto.defaultBreakStart || null,
        dto.defaultBreakEnd || null,
        dto.defaultLateToleranceMinutes ?? null,
        dto.defaultBaseWeightWalkin ?? null,
        dto.defaultBaseWeightAppointment ?? null,
        dto.defaultEscalationRateWalkin ?? null,
        dto.defaultEscalationRateAppointment ?? null,
        dto.defaultCarryOverWaiting ?? null,
        dto.defaultDailyResetMode || null,
        dto.defaultDailyResetTime || null,
        dto.defaultLocale || null,
        userId,
        now,
      ],
    );
    return rows[0];
  }

  async findActiveById(siteId: number): Promise<SiteResponseDto | null> {
    const rows = await this.dataSource.query<SiteResponseDto[]>(
      'SELECT * FROM dori_site WHERE site_id = $1 AND is_active = TRUE',
      [siteId],
    );
    return rows[0] ?? null;
  }

  async update(
    siteId: number,
    dto: UpdateSiteDto,
    userId: number,
    now: Date,
  ): Promise<SiteResponseDto> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      if (value !== undefined) {
        values.push(value);
        fields.push(`${column} = $${values.length}`);
      }
    };
    add('site_name', dto.siteName);
    add('site_location', dto.siteLocation);
    add('site_logo_url', dto.siteLogoUrl);
    add('site_type', dto.siteType);
    add('timezone', dto.timezone);
    add('default_currency', dto.defaultCurrency);
    add('default_appointments_enabled', dto.defaultAppointmentsEnabled);
    add(
      'default_appointment_slot_duration',
      dto.defaultAppointmentSlotDuration,
    );
    add('default_slot_capacity', dto.defaultSlotCapacity);
    add('default_working_hours_start', dto.defaultWorkingHoursStart);
    add('default_working_hours_end', dto.defaultWorkingHoursEnd);
    add('default_break_start', dto.defaultBreakStart);
    add('default_break_end', dto.defaultBreakEnd);
    add('default_late_tolerance_minutes', dto.defaultLateToleranceMinutes);
    add('default_base_weight_walkin', dto.defaultBaseWeightWalkin);
    add('default_base_weight_appointment', dto.defaultBaseWeightAppointment);
    add('default_escalation_rate_walkin', dto.defaultEscalationRateWalkin);
    add(
      'default_escalation_rate_appointment',
      dto.defaultEscalationRateAppointment,
    );
    add('default_carry_over_waiting', dto.defaultCarryOverWaiting);
    add('default_daily_reset_mode', dto.defaultDailyResetMode);
    add('default_daily_reset_time', dto.defaultDailyResetTime);
    add('default_locale', dto.defaultLocale);
    add('is_active', dto.isActive);
    add('updated_by_user_id', userId);
    add('updated_at', now);
    values.push(siteId);
    const rows = await this.dataSource.query<SiteResponseDto[]>(
      `UPDATE dori_site SET ${fields.join(', ')} WHERE site_id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0];
  }

  deactivate(siteId: number, userId: number, now: Date): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_site SET is_active = FALSE, deleted_at = $1,
         updated_by_user_id = $2, updated_at = $1 WHERE site_id = $3`,
        [now, userId, siteId],
      );
      await manager.query(
        `UPDATE dori_site_queue_thread SET is_active = FALSE, deleted_at = $1,
         updated_by_user_id = $2, updated_at = $1
         WHERE site_id = $3 AND is_active = TRUE`,
        [now, userId, siteId],
      );
    });
  }

  async findManagers(
    siteId: number,
    sortField: string,
    sortOrder: 'ASC' | 'DESC',
    pageSize: number,
    offset: number,
  ): Promise<{ items: SiteManagerResponseDto[]; total: number }> {
    const from = `FROM dori_user_site us JOIN dori_user u ON u.user_id = us.user_id
      WHERE us.site_id = $1 AND u.is_active = TRUE`;
    const [count] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*)::int AS total ${from}`,
      [siteId],
    );
    const items = await this.dataSource.query<SiteManagerResponseDto[]>(
      `SELECT u.user_id, u.username, u.email, u.user_type, u.is_active, us.assigned_at
       ${from} ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      [siteId],
    );
    return { items, total: count?.total ?? 0 };
  }

  async findUserStatus(userId: number): Promise<UserStatusRow | null> {
    const rows = await this.dataSource.query<UserStatusRow[]>(
      'SELECT user_id, is_active FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL',
      [userId],
    );
    return rows[0] ?? null;
  }

  async hasActiveManagerRole(userId: number): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ user_id: number }>>(
      `SELECT ur.user_id FROM dori_user_role ur JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name = 'manager' AND r.is_active = TRUE LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  async assignManager(
    siteId: number,
    userId: number,
    assignedBy: number,
    now: Date,
  ) {
    await this.dataSource.query(
      `INSERT INTO dori_user_site (user_id, site_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, site_id) DO NOTHING`,
      [userId, siteId, now, assignedBy],
    );
  }

  async removeManager(siteId: number, userId: number) {
    await this.dataSource.query(
      'DELETE FROM dori_user_site WHERE user_id = $1 AND site_id = $2',
      [userId, siteId],
    );
  }
}
