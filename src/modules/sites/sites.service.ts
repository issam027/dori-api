import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { PaginationDto, PaginatedResult } from '../../core/pagination/pagination.dto';
import { SiteManagerResponseDto } from './dto/site-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class SitesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) { }

  async findSites(pagination: PaginationDto, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    // VAL-01 : allowlist des colonnes autorisées pour dori_site
    const sortField = pagination.getSafeSortField(
      ['site_id', 'site_name', 'site_type', 'created_at', 'updated_at'],
      'created_at',
    );

    let query = `SELECT * FROM dori_site WHERE is_active = TRUE`;
    const params: any[] = [];

    if (!scope.isGlobal) {
      if (scope.siteIds.length === 0) {
        return pagination.createResponse([], 0);
      }
      params.push(scope.siteIds);
      query += ` AND site_id = ANY($${params.length})`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return pagination.createResponse(items, total);
  }

  async createSite(dto: CreateSiteDto, user: AuthenticatedUser) {
    const now = this.clockService.now();
    const query = `
      INSERT INTO dori_site (
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
        COALESCE($10, '08:00'), COALESCE($11, '17:00'),
        COALESCE($12, '12:00'), COALESCE($13, '14:00'),
        COALESCE($14, 60), COALESCE($15, 0), COALESCE($16, 60),
        COALESCE($17, 1), COALESCE($18, 1), COALESCE($19, FALSE),
        COALESCE($20, 'close_all'), COALESCE($21, '03:00'), COALESCE($22, 'fr'),
        $23, $23, $24, $24
      ) RETURNING *
    `;

    const values = [
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
      user.userId,
      now,
    ];

    const result = await this.dataSource.query(query, values);
    return result[0];
  }

  async findSiteById(siteId: number, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const sites = await this.dataSource.query(
      `SELECT * FROM dori_site WHERE site_id = $1 AND is_active = TRUE`,
      [siteId],
    );
    if (!sites || sites.length === 0) {
      throw new DoriException('SITE_NOT_FOUND', { siteId });
    }
    return sites[0];
  }

  async updateSite(
    siteId: number,
    dto: UpdateSiteDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    await this.findSiteById(siteId, user);

    const now = this.clockService.now();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const mapField = (dbCol: string, val: any) => {
      if (val !== undefined) {
        fields.push(`${dbCol} = $${idx++}`);
        values.push(val);
      }
    };

    mapField('site_name', dto.siteName);
    mapField('site_location', dto.siteLocation);
    mapField('site_logo_url', dto.siteLogoUrl);
    mapField('site_type', dto.siteType);
    mapField('timezone', dto.timezone);
    mapField('default_currency', dto.defaultCurrency);
    mapField('default_appointments_enabled', dto.defaultAppointmentsEnabled);
    mapField(
      'default_appointment_slot_duration',
      dto.defaultAppointmentSlotDuration,
    );
    mapField('default_slot_capacity', dto.defaultSlotCapacity);
    mapField('default_working_hours_start', dto.defaultWorkingHoursStart);
    mapField('default_working_hours_end', dto.defaultWorkingHoursEnd);
    mapField('default_break_start', dto.defaultBreakStart);
    mapField('default_break_end', dto.defaultBreakEnd);
    mapField('default_late_tolerance_minutes', dto.defaultLateToleranceMinutes);
    mapField('default_base_weight_walkin', dto.defaultBaseWeightWalkin);
    mapField(
      'default_base_weight_appointment',
      dto.defaultBaseWeightAppointment,
    );
    mapField('default_escalation_rate_walkin', dto.defaultEscalationRateWalkin);
    mapField(
      'default_escalation_rate_appointment',
      dto.defaultEscalationRateAppointment,
    );
    mapField('default_carry_over_waiting', dto.defaultCarryOverWaiting);
    mapField('default_daily_reset_mode', dto.defaultDailyResetMode);
    mapField('default_daily_reset_time', dto.defaultDailyResetTime);
    mapField('default_locale', dto.defaultLocale);
    mapField('is_active', dto.isActive);

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(siteId);

    const result = await this.dataSource.query(
      `UPDATE dori_site SET ${fields.join(', ')} WHERE site_id = $${idx} RETURNING *`,
      values,
    );
    return result[0];
  }

  async deleteSite(siteId: number, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    await this.findSiteById(siteId, user);

    const now = this.clockService.now();
    // Soft delete site
    await this.dataSource.query(
      `UPDATE dori_site
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE site_id = $3`,
      [now, user.userId, siteId],
    );

    // Cascades deactivation to all queues of the site (§8.1)
    await this.dataSource.query(
      `UPDATE dori_site_queue_thread
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE site_id = $3 AND is_active = TRUE`,
      [now, user.userId, siteId],
    );

    return { siteId, deleted: true };
  }

  async findSiteManagers(
    siteId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteManagerResponseDto>> {
    await this.scopeService.checkSiteAccess(user, siteId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    // VAL-01 : allowlist pour le JOIN dori_user_site / dori_user
    const sortField = pagination.getSafeSortField(
      ['u.user_id', 'u.username', 'u.email', 'us.assigned_at'],
      'us.assigned_at',
    );

    const query = `
      SELECT u.user_id, u.username, u.email, u.user_type, u.is_active, us.assigned_at
      FROM dori_user_site us
      JOIN dori_user u ON u.user_id = us.user_id
      WHERE us.site_id = $1 AND u.is_active = TRUE
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      [siteId],
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `${query} ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      [siteId],
    );

    const formattedItems = items.map((m: any) => ({
      userId: m.user_id,
      username: m.username,
      email: m.email,
      isActive: m.is_active ?? true,
      userType: m.user_type,
      assignedAt: m.assigned_at,
    }));

    return pagination.createResponse<SiteManagerResponseDto>(formattedItems, total);
  }

  async getSiteManagers(
    siteId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteManagerResponseDto>> {
    let pagination: PaginationDto;
    let user: AuthenticatedUser;

    if (paginationOrUser && 'userId' in paginationOrUser) {
      user = paginationOrUser as AuthenticatedUser;
      pagination = new PaginationDto();
    } else {
      pagination = (paginationOrUser as PaginationDto) || new PaginationDto();
      user = maybeUser!;
    }

    return this.findSiteManagers(siteId, pagination, user);
  }

  async assignSiteManager(
    siteId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);

    // 1. Vérifier que le targetUser existe et est actif
    const userRes = await this.dataSource.query(
      `SELECT user_id, is_active FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [targetUserId],
    );
    if (!userRes || userRes.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    if (!userRes[0].is_active) {
      throw new DoriException('ACCOUNT_LOCKED', { userId: targetUserId });
    }

    // 2. Vérifier que le targetUser possède bien le rôle 'manager' actif
    const managerRoleRes = await this.dataSource.query(
      `SELECT ur.user_id
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.role_name = 'manager' AND r.is_active = TRUE
       LIMIT 1`,
      [targetUserId],
    );
    if (!managerRoleRes || managerRoleRes.length === 0) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }

    const now = this.clockService.now();

    await this.dataSource.query(
      `INSERT INTO dori_user_site (user_id, site_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, site_id) DO NOTHING`,
      [targetUserId, siteId, now, user.userId],
    );

    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, assigned: true };
  }

  async assignManager(
    siteId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    return this.assignSiteManager(siteId, targetUserId, user);
  }

  async removeSiteManager(
    siteId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);

    await this.dataSource.query(
      `DELETE FROM dori_user_site WHERE user_id = $1 AND site_id = $2`,
      [targetUserId, siteId],
    );

    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, removed: true };
  }

  async removeManager(
    siteId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    return this.removeSiteManager(siteId, targetUserId, user);
  }
}
