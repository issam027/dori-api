import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  SetUserPasswordDto,
  UpdateRolePermissionsDto,
  UserFilterDto,
} from './dto/user.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  private async getCallerMaxRank(user: AuthenticatedUser): Promise<number> {
    if (user.roles?.includes('root')) {
      return 5;
    }
    const rolesRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.userId],
    );
    return Number(rolesRes[0]?.max_rank || 0);
  }

  private async getUserMaxRank(targetUserId: number): Promise<number> {
    const userRes = await this.dataSource.query(
      `SELECT user_id, user_type FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [targetUserId],
    );
    if (!userRes || userRes.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }

    const rolesRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [targetUserId],
    );
    const maxRank = Number(rolesRes[0]?.max_rank || 0);
    if (maxRank > 0) return maxRank;

    if (userRes[0].user_type === 'kiosk') {
      return 1;
    }
    return 0;
  }

  private async getCallerMaxManageRank(user: AuthenticatedUser): Promise<number> {
    if (user.roles?.includes('root')) {
      return 5;
    }

    const permsRes = await this.dataSource.query(
      `SELECT DISTINCT p.permission_name
       FROM dori_user_role ur
       JOIN dori_role_permission rp ON rp.role_id = ur.role_id
       JOIN dori_permission p ON p.permission_id = rp.permission_id
       WHERE ur.user_id = $1 AND p.is_active = TRUE`,
      [user.userId],
    );

    const permissions = new Set<string>([
      ...(user.permissions || []),
      ...permsRes.map((r: any) => r.permission_name),
    ]);

    if (permissions.has('system_manage') || permissions.has('user_manage_admin')) {
      return 4;
    }
    if (permissions.has('user_manage_manager')) {
      return 3;
    }
    if (permissions.has('user_manage_hostess')) {
      return 2;
    }
    if (permissions.has('user_manage_kiosk')) {
      return 1;
    }

    return 0;
  }

  private async checkAntiEscalation(
    caller: AuthenticatedUser,
    targetUserId?: number,
    targetRoleId?: number,
  ) {
    if (caller.roles?.includes('root')) {
      return; // root can manage anything
    }

    const callerRank = await this.getCallerMaxRank(caller);
    const maxManageRank = await this.getCallerMaxManageRank(caller);

    if (maxManageRank === 0) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    if (targetUserId) {
      const targetRank = await this.getUserMaxRank(targetUserId);

      // Profil du modificateur (anti-escalade de rang) :
      // On ne peut pas modifier un utilisateur ayant un rang supérieur ou égal au sien
      if (targetRank >= callerRank) {
        throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
      }

      // Profil du user à modifier :
      // Si une personne a la permission user_manage_hostess (maxManageRank = 2),
      // il ne pourra pas modifier un user ayant un profil supérieur à l'hôtesse (targetRank > 2)
      if (targetRank > maxManageRank) {
        throw new DoriException('FORBIDDEN_PERMISSION');
      }
    }

    if (targetRoleId) {
      const roleRes = await this.dataSource.query(
        `SELECT rank FROM dori_role WHERE role_id = $1 AND is_active = TRUE`,
        [targetRoleId],
      );
      if (roleRes && roleRes.length > 0) {
        const roleRank = Number(roleRes[0].rank);

        if (roleRank >= callerRank) {
          throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
        }

        if (roleRank > maxManageRank) {
          throw new DoriException('FORBIDDEN_PERMISSION');
        }
      }
    }
  }

  async findUsers(filter: UserFilterDto, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    // VAL-01 : allowlist des colonnes autorisées pour dori_user (alias u)
    const sortField = filter.getSafeSortField(
      ['u.user_id', 'u.username', 'u.email', 'u.user_type', 'u.is_active', 'u.last_login', 'u.created_at', 'u.updated_at'],
      'u.created_at',
    );

    let query = `
      SELECT DISTINCT u.user_id, u.username, u.email, u.user_type, u.is_active,
             u.language_preference, u.last_login, u.created_at, u.updated_at
      FROM dori_user u
      LEFT JOIN dori_user_site us ON us.user_id = u.user_id
      LEFT JOIN dori_user_queue uq ON uq.user_id = u.user_id
      WHERE u.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (!scope.isGlobal) {
      if (user.roles?.includes('manager')) {
        if (scope.siteIds.length === 0) return filter.createResponse([], 0);
        params.push(scope.siteIds);
        query += ` AND us.site_id = ANY($${params.length})`;
      } else {
        if (scope.queueIds.length === 0) return filter.createResponse([], 0);
        params.push(scope.queueIds);
        query += ` AND uq.queue_id = ANY($${params.length})`;
      }
    }

    if (filter.userType) {
      params.push(filter.userType);
      query += ` AND u.user_type = $${params.length}`;
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const pIdx = params.length;
      query += ` AND (u.username ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) count_q`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async findUserById(userId: number, user: AuthenticatedUser) {
    const users = await this.dataSource.query(
      `SELECT user_id, username, email, user_type, is_active, language_preference, last_login, created_at, updated_at
       FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!users || users.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId });
    }

    if (!user.roles?.includes('root') && user.userId !== userId) {
      const maxManageRank = await this.getCallerMaxManageRank(user);
      const targetRank = await this.getUserMaxRank(userId);
      if (targetRank > maxManageRank) {
        throw new DoriException('FORBIDDEN_PERMISSION');
      }
    }

    const targetUser = users[0];

    // Roles
    const roles = await this.dataSource.query(
      `SELECT r.role_id, r.role_name, r.rank, r.description
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );

    // Sites
    const sites = await this.dataSource.query(
      `SELECT s.site_id, s.site_name, s.site_type
       FROM dori_user_site us
       JOIN dori_site s ON s.site_id = us.site_id
       WHERE us.user_id = $1`,
      [userId],
    );

    // Queues
    const queues = await this.dataSource.query(
      `SELECT q.queue_id, q.queue_code, q.queue_name, q.site_id
       FROM dori_user_queue uq
       JOIN dori_site_queue_thread q ON q.queue_id = uq.queue_id
       WHERE uq.user_id = $1`,
      [userId],
    );

    return {
      ...targetUser,
      roles,
      sites,
      queues,
    };
  }

  async createUser(dto: CreateUserDto, user: AuthenticatedUser) {
    if (dto.roleId) {
      await this.checkAntiEscalation(user, undefined, dto.roleId);
    } else {
      await this.checkAntiEscalation(user);
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `INSERT INTO dori_user (
        username, email, password_hash, user_type, language_preference,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, COALESCE($4, 'human'), COALESCE($5, 'fr'), $6, $6, $7, $7)
      RETURNING user_id, username, email, user_type, is_active, language_preference, created_at`,
      [
        dto.username,
        dto.email || null,
        hash,
        dto.userType || null,
        dto.languagePreference || null,
        user.userId,
        now,
      ],
    );

    const newUser = res[0];

    if (dto.roleId) {
      await this.dataSource.query(
        `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [newUser.user_id, dto.roleId, now, user.userId],
      );
    }

    return newUser;
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(dto.email);
    }
    if (dto.languagePreference !== undefined) {
      fields.push(`language_preference = $${idx++}`);
      values.push(dto.languagePreference);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(userId);

    const res = await this.dataSource.query(
      `UPDATE dori_user SET ${fields.join(', ')} WHERE user_id = $${idx}
       RETURNING user_id, username, email, user_type, is_active, language_preference, updated_at`,
      values,
    );

    return res[0];
  }

  async updateUserStatus(
    userId: number,
    dto: UpdateUserStatusDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_user
       SET is_active = $1, updated_by_user_id = $2, updated_at = $3
       WHERE user_id = $4`,
      [dto.isActive, user.userId, now, userId],
    );

    // If deactivating: immediately revoke all sessions (§4.12)
    if (!dto.isActive) {
      await this.dataSource.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'account_disabled'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    }

    return { userId, isActive: dto.isActive };
  }

  async setUserPassword(
    userId: number,
    dto: SetUserPasswordDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const hash = await bcrypt.hash(dto.newPassword, 12);
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_user
       SET password_hash = $1, must_change_password = TRUE, password_changed_at = $2,
           updated_by_user_id = $3, updated_at = $2
       WHERE user_id = $4`,
      [hash, now, user.userId, userId],
    );

    // Revoke all sessions on admin password change (§4.12)
    await this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'password_changed'
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [now, userId],
    );

    return { userId, passwordUpdated: true };
  }

  async assignUserRole(
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);
    const now = this.clockService.now();

    await this.dataSource.query(
      `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId, now, user.userId],
    );

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, assigned: true };
  }

  async removeUserRole(
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);

    await this.dataSource.query(
      `DELETE FROM dori_user_role WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId],
    );

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, removed: true };
  }

  // Roles and Permissions (§5.9, §4.9)
  async getRoles(pagination: PaginationDto) {
    const { pageSize, offset } = pagination.getParams();

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM dori_role WHERE is_active = TRUE`,
    );
    const total = countRes[0]?.total || 0;

    const roles = await this.dataSource.query(
      `SELECT * FROM dori_role
       WHERE is_active = TRUE
       ORDER BY rank ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
    );

    // Attach permissions
    for (const r of roles) {
      const perms = await this.dataSource.query(
        `SELECT p.permission_name, p.description
         FROM dori_role_permission rp
         JOIN dori_permission p ON p.permission_id = rp.permission_id
         WHERE rp.role_id = $1 AND p.is_active = TRUE`,
        [r.role_id],
      );
      r.permissions = perms.map((p: any) => p.permission_name);
    }

    return pagination.createResponse(roles, total);
  }

  async updateRolePermissions(
    roleId: number,
    dto: UpdateRolePermissionsDto,
    user: AuthenticatedUser,
  ) {
    const now = this.clockService.now();

    await this.dataSource.transaction(async (manager) => {
      // Clear existing
      await manager.query(
        `DELETE FROM dori_role_permission WHERE role_id = $1`,
        [roleId],
      );

      if (dto.permissionNames && dto.permissionNames.length > 0) {
        await manager.query(
          `INSERT INTO dori_role_permission (role_id, permission_id, assigned_at, assigned_by_user_id)
           SELECT $1, permission_id, $2, $3
           FROM dori_permission
           WHERE permission_name = ANY($4)`,
          [roleId, now, user.userId, dto.permissionNames],
        );
      }
    });

    this.scopeService.clearAllScopeCache();
    return { roleId, permissionsUpdated: true };
  }
}
