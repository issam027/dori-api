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
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { UserSummaryItemDto, RoleResponseDto } from './dto/user-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { ConfigService } from '@nestjs/config';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class UsersRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
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

  private async getCallerMaxManageRank(
    user: AuthenticatedUser,
  ): Promise<number> {
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

    if (
      permissions.has('system_manage') ||
      permissions.has('user_manage_admin')
    ) {
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

    // BUG1 : Une hÃ´tesse ne peut rien modifier (ni kiosk, ni tout rÃ´le infÃ©rieur Ã  manager)
    if (
      callerRank < 3 ||
      caller.roles?.includes('hotesse') ||
      caller.roles?.includes('kiosk')
    ) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    // BUG1 : Plafond des profils modifiables selon le rÃ´le et les permissions de l'appelant
    // - Un manager (rank 3) peut modifier son user et les users hotesse (2) et kioske (1)
    // - Les admin (rank 4) peuvent faire ce que le manager peut et aussi modifier les managers (3)
    let maxManageRank = 2; // hotesse & kiosk par dÃ©faut pour manager
    if (callerRank >= 4 || caller.roles?.includes('admin')) {
      maxManageRank = 3; // admin peut aussi modifier les managers
    }
    const callerMaxManagePerm = await this.getCallerMaxManageRank(caller);
    if (callerMaxManagePerm > 0 && callerMaxManagePerm < maxManageRank) {
      maxManageRank = callerMaxManagePerm;
    }

    if (targetUserId) {
      // Un manager ou admin peut modifier son propre compte
      if (caller.userId === targetUserId) {
        return;
      }

      const targetRank = await this.getUserMaxRank(targetUserId);

      // Si le profil cible dÃ©passe le plafond autorisÃ© pour le rÃ´le du modificateur
      if (targetRank > maxManageRank) {
        if (targetRank >= callerRank) {
          throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
        }
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

        if (roleRank > maxManageRank) {
          if (roleRank >= callerRank) {
            throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
          }
          throw new DoriException('FORBIDDEN_PERMISSION');
        }
      }
    }
  }

  async findUsers(
    filter: UserFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<UserSummaryItemDto>> {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    // VAL-01 : allowlist des colonnes autorisÃ©es pour dori_user (alias u)
    const sortField = filter.getSafeSortField(
      [
        'u.user_id',
        'u.username',
        'u.email',
        'u.user_type',
        'u.is_active',
        'u.last_login',
        'u.created_at',
        'u.updated_at',
      ],
      'u.created_at',
    );

    let query = `
      SELECT DISTINCT u.user_id, u.username, u.email, u.user_type, u.is_active,
             u.language_preference, u.last_login, u.created_at, u.updated_at
      FROM dori_user u
      LEFT JOIN dori_user_site us ON us.user_id = u.user_id
      LEFT JOIN dori_user_queue uq ON uq.user_id = u.user_id
      LEFT JOIN dori_site_queue_thread sqt ON sqt.queue_id = uq.queue_id
      LEFT JOIN dori_user_role ur ON ur.user_id = u.user_id
      LEFT JOIN dori_role r ON r.role_id = ur.role_id
      WHERE u.deleted_at IS NULL
    `;
    const params: any[] = [];

    // BUG1 : Le listing est compartimentÃ© par "site" auquel le user qui fait appel est affectÃ©.
    // Il est total pour ce site (hÃ´tesses, managers du site) ainsi que les administrateurs et root.
    if (!scope.isGlobal) {
      if (scope.siteIds.length === 0) {
        query += ` AND r.role_name IN ('admin', 'root')`;
      } else {
        params.push(scope.siteIds);
        const pIdx = params.length;
        query += ` AND (us.site_id = ANY($${pIdx}) OR sqt.site_id = ANY($${pIdx}) OR r.role_name IN ('admin', 'root'))`;
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
    const scope = await this.scopeService.getUserScope(user);

    const users = await this.dataSource.query(
      `SELECT user_id, username, email, user_type, is_active, language_preference, last_login, created_at, updated_at
       FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!users || users.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId });
    }

    // BUG1 : Le listing/dÃ©tail est total : une hÃ´tesse ou un manager peut voir les managers et admins.
    // Si l'utilisateur n'est pas global et consulte un tiers, on s'assure qu'il est rattachÃ© aux mÃªmes sites ou admin/root.
    if (!scope.isGlobal && user.userId !== userId) {
      if (scope.siteIds.length === 0) {
        const isAdminOrRoot = await this.dataSource.query(
          `SELECT 1 FROM dori_user_role ur
           JOIN dori_role r ON r.role_id = ur.role_id
           WHERE ur.user_id = $1 AND r.role_name IN ('admin', 'root')
           LIMIT 1`,
          [userId],
        );
        if (!isAdminOrRoot || isAdminOrRoot.length === 0) {
          throw new DoriException('USER_NOT_FOUND', { userId });
        }
      } else {
        const inScope = await this.dataSource.query(
          `SELECT 1 FROM dori_user u
           LEFT JOIN dori_user_site us ON us.user_id = u.user_id
           LEFT JOIN dori_user_queue uq ON uq.user_id = u.user_id
           LEFT JOIN dori_site_queue_thread sqt ON sqt.queue_id = uq.queue_id
           LEFT JOIN dori_user_role ur ON ur.user_id = u.user_id
           LEFT JOIN dori_role r ON r.role_id = ur.role_id
           WHERE u.user_id = $1 AND (us.site_id = ANY($2) OR sqt.site_id = ANY($2) OR r.role_name IN ('admin', 'root'))
           LIMIT 1`,
          [userId, scope.siteIds],
        );
        if (!inScope || inScope.length === 0) {
          throw new DoriException('USER_NOT_FOUND', { userId });
        }
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

    const saltRounds =
      this.configService?.get<number>('security.bcryptRounds') || 12;
    const hash = await bcrypt.hash(dto.password, saltRounds);
    const now = this.clockService.now();

    return this.dataSource.transaction(async (manager) => {
      if (dto.roleId) {
        const roles = await manager.query(
          `SELECT role_id FROM dori_role WHERE role_id = $1 AND is_active = TRUE FOR SHARE`,
          [dto.roleId],
        );
        if (roles.length === 0) throw new DoriException('ROLE_NOT_FOUND');
      }
      const res = await manager.query(
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
        await manager.query(
          `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
          [newUser.user_id, dto.roleId, now, user.userId],
        );
      }

      return newUser;
    });
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

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
       SET is_active = $1, updated_by_user_id = $2, updated_at = $3
       WHERE user_id = $4`,
        [dto.isActive, user.userId, now, userId],
      );

      // If deactivating: immediately revoke all sessions (Â§4.12)
      if (!dto.isActive) {
        await manager.query(
          `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'account_disabled'
         WHERE user_id = $2 AND revoked_at IS NULL`,
          [now, userId],
        );
      }
    });

    return { userId, isActive: dto.isActive };
  }

  async setUserPassword(
    userId: number,
    dto: SetUserPasswordDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const saltRounds =
      this.configService?.get<number>('security.bcryptRounds') || 12;
    const hash = await bcrypt.hash(dto.newPassword, saltRounds);
    const now = this.clockService.now();

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
       SET password_hash = $1, must_change_password = TRUE, password_changed_at = $2,
           updated_by_user_id = $3, updated_at = $2
       WHERE user_id = $4`,
        [hash, now, user.userId, userId],
      );

      // Revoke all sessions on admin password change (Â§4.12)
      await manager.query(
        `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'password_changed'
       WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });

    return { userId, passwordUpdated: true };
  }

  async assignUserRole(
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);
    const now = this.clockService.now();

    const assigned = await this.dataSource.transaction(async (manager) => {
      const resources = await manager.query(
        `SELECT
           EXISTS(SELECT 1 FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL) AS user_exists,
           EXISTS(SELECT 1 FROM dori_role WHERE role_id = $2 AND is_active = TRUE) AS role_exists`,
        [userId, roleId],
      );
      if (!resources[0]?.user_exists)
        throw new DoriException('USER_NOT_FOUND', { userId });
      if (!resources[0]?.role_exists)
        throw new DoriException('ROLE_NOT_FOUND', { roleId });
      const rows = await manager.query(
        `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role_id) DO NOTHING
         RETURNING role_id`,
        [userId, roleId, now, user.userId],
      );
      if (rows.length > 0) {
        await manager.query(
          `UPDATE dori_user_session SET revoked_at = $1, revoked_reason = 'admin'
           WHERE user_id = $2 AND revoked_at IS NULL`,
          [now, userId],
        );
      }
      return rows.length > 0;
    });

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, assigned };
  }

  async removeUserRole(
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);

    const now = this.clockService.now();
    const removed = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `DELETE FROM dori_user_role WHERE user_id = $1 AND role_id = $2 RETURNING role_id`,
        [userId, roleId],
      );
      if (rows.length > 0) {
        await manager.query(
          `UPDATE dori_user_session SET revoked_at = $1, revoked_reason = 'admin'
           WHERE user_id = $2 AND revoked_at IS NULL`,
          [now, userId],
        );
      }
      return rows.length > 0;
    });

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, removed };
  }

  // Roles and Permissions (Â§5.9, Â§4.9)
  async getRoles(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<RoleResponseDto>> {
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
      const roles = await manager.query(
        `SELECT role_id FROM dori_role WHERE role_id = $1 AND is_active = TRUE FOR UPDATE`,
        [roleId],
      );
      if (roles.length === 0)
        throw new DoriException('ROLE_NOT_FOUND', { roleId });

      const requested = Array.from(new Set(dto.permissionNames || []));
      const permissions = requested.length
        ? await manager.query(
            `SELECT permission_name FROM dori_permission
             WHERE permission_name = ANY($1) AND is_active = TRUE`,
            [requested],
          )
        : [];
      const found = new Set(
        permissions.map((item: any) => item.permission_name),
      );
      const unknown = requested.filter((name) => !found.has(name));
      if (unknown.length > 0) {
        throw new DoriException('PERMISSION_NOT_FOUND', {
          permissions: unknown,
        });
      }

      // Clear existing
      await manager.query(
        `DELETE FROM dori_role_permission WHERE role_id = $1`,
        [roleId],
      );

      if (requested.length > 0) {
        await manager.query(
          `INSERT INTO dori_role_permission (role_id, permission_id, assigned_at, assigned_by_user_id)
           SELECT $1, permission_id, $2, $3
           FROM dori_permission
           WHERE permission_name = ANY($4)`,
          [roleId, now, user.userId, requested],
        );
      }
      await manager.query(
        `UPDATE dori_user_session s
         SET revoked_at = $1, revoked_reason = 'admin'
         WHERE s.user_id IN (SELECT user_id FROM dori_user_role WHERE role_id = $2)
           AND s.revoked_at IS NULL`,
        [now, roleId],
      );
    });

    this.scopeService.clearAllScopeCache();
    return { roleId, permissionsUpdated: true };
  }

  async deleteUser(userId: number, user: AuthenticatedUser) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE user_id = $3`,
        [now, user.userId, userId],
      );

      // 2. RÃ©vocation immÃ©diate de toutes les sessions actives (Â§4.12)
      await manager.query(
        `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'account_deleted'
       WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });

    this.scopeService.invalidateUserScope(userId);

    return { userId, deleted: true };
  }
}
