import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpdateUserDto, UserFilterDto } from './dto/user.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import { UserSummaryItemDto, RoleResponseDto } from './dto/user-response.dto';

export interface UserDetailsResult {
  user_id: number;
  username: string;
  email: string | null;
  user_type: string;
  is_active: boolean;
  language_preference: string;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: Array<{
    role_id: number;
    role_name: string;
    rank: number;
    description: string;
  }>;
  sites: Array<{
    site_id: number;
    site_name: string;
    site_type: string;
  }>;
  queues: Array<{
    queue_id: number;
    queue_code: string;
    queue_name: string;
    site_id: number;
  }>;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getCallerMaxRank(userId: number): Promise<number> {
    const rolesRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );
    return Number(rolesRes[0]?.max_rank || 0);
  }

  async getUserMaxRank(
    userId: number,
  ): Promise<{ exists: boolean; maxRank: number; userType?: string }> {
    const userRes = await this.dataSource.query(
      `SELECT user_id, user_type FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!userRes || userRes.length === 0) {
      return { exists: false, maxRank: 0 };
    }

    const rolesRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );
    const maxRank = Number(rolesRes[0]?.max_rank || 0);

    return {
      exists: true,
      maxRank,
      userType: userRes[0].user_type,
    };
  }

  async getUserPermissionNames(userId: number): Promise<string[]> {
    const permsRes = await this.dataSource.query(
      `SELECT DISTINCT p.permission_name
       FROM dori_user_role ur
       JOIN dori_role_permission rp ON rp.role_id = ur.role_id
       JOIN dori_permission p ON p.permission_id = rp.permission_id
       WHERE ur.user_id = $1 AND p.is_active = TRUE`,
      [userId],
    );
    return permsRes.map((r: any) => r.permission_name);
  }

  async getRoleRank(roleId: number): Promise<number | null> {
    const roleRes = await this.dataSource.query(
      `SELECT rank FROM dori_role WHERE role_id = $1 AND is_active = TRUE`,
      [roleId],
    );
    if (!roleRes || roleRes.length === 0) {
      return null;
    }
    return Number(roleRes[0].rank);
  }

  async findUsers(
    filter: UserFilterDto,
    scope: { isGlobal: boolean; siteIds: number[] },
  ): Promise<PaginatedResult<UserSummaryItemDto>> {
    const { pageSize, offset, sortOrder } = filter.getParams();
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

  async findUserById(userId: number): Promise<UserDetailsResult | null> {
    const users = await this.dataSource.query(
      `SELECT user_id, username, email, user_type, is_active, language_preference, last_login, created_at, updated_at
       FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId],
    );

    if (!users || users.length === 0) {
      return null;
    }

    const targetUser = users[0];

    const roles = await this.dataSource.query(
      `SELECT r.role_id, r.role_name, r.rank, r.description
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );

    const sites = await this.dataSource.query(
      `SELECT s.site_id, s.site_name, s.site_type
       FROM dori_user_site us
       JOIN dori_site s ON s.site_id = us.site_id
       WHERE us.user_id = $1`,
      [userId],
    );

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

  async createUser(params: {
    username: string;
    email?: string;
    passwordHash: string;
    userType?: string;
    languagePreference?: string;
    roleId?: number;
    creatorUserId: number;
    now: Date;
  }): Promise<any | null> {
    return this.dataSource.transaction(async (manager) => {
      if (params.roleId) {
        const roles = await manager.query(
          `SELECT role_id FROM dori_role WHERE role_id = $1 AND is_active = TRUE FOR SHARE`,
          [params.roleId],
        );
        if (roles.length === 0) return null;
      }

      const res = await manager.query(
        `INSERT INTO dori_user (
          username, email, password_hash, user_type, language_preference,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, COALESCE($4, 'human'), COALESCE($5, 'fr'), $6, $6, $7, $7)
        RETURNING user_id, username, email, user_type, is_active, language_preference, created_at`,
        [
          params.username,
          params.email || null,
          params.passwordHash,
          params.userType || null,
          params.languagePreference || null,
          params.creatorUserId,
          params.now,
        ],
      );

      const newUser = res[0];

      if (params.roleId) {
        await manager.query(
          `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [newUser.user_id, params.roleId, params.now, params.creatorUserId],
        );
      }

      return newUser;
    });
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    updaterUserId: number,
    now: Date,
  ): Promise<any> {
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
    values.push(updaterUserId);
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
    isActive: boolean,
    updaterUserId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
         SET is_active = $1, updated_by_user_id = $2, updated_at = $3
         WHERE user_id = $4`,
        [isActive, updaterUserId, now, userId],
      );

      if (!isActive) {
        await manager.query(
          `UPDATE dori_user_session
           SET revoked_at = $1, revoked_reason = 'account_disabled'
           WHERE user_id = $2 AND revoked_at IS NULL`,
          [now, userId],
        );
      }
    });
  }

  async setUserPassword(
    userId: number,
    passwordHash: string,
    updaterUserId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
         SET password_hash = $1, must_change_password = TRUE, password_changed_at = $2,
             updated_by_user_id = $3, updated_at = $2
         WHERE user_id = $4`,
        [passwordHash, now, updaterUserId, userId],
      );

      await manager.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'password_changed'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });
  }

  async assignUserRole(
    userId: number,
    roleId: number,
    assignedByUserId: number,
    now: Date,
  ): Promise<{ userExists: boolean; roleExists: boolean; assigned: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const resources = await manager.query(
        `SELECT
           EXISTS(SELECT 1 FROM dori_user WHERE user_id = $1 AND deleted_at IS NULL) AS user_exists,
           EXISTS(SELECT 1 FROM dori_role WHERE role_id = $2 AND is_active = TRUE) AS role_exists`,
        [userId, roleId],
      );
      const userExists = !!resources[0]?.user_exists;
      const roleExists = !!resources[0]?.role_exists;
      if (!userExists || !roleExists) {
        return { userExists, roleExists, assigned: false };
      }

      const rows = await manager.query(
        `INSERT INTO dori_user_role (user_id, role_id, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role_id) DO NOTHING
         RETURNING role_id`,
        [userId, roleId, now, assignedByUserId],
      );

      if (rows.length > 0) {
        await manager.query(
          `UPDATE dori_user_session SET revoked_at = $1, revoked_reason = 'admin'
           WHERE user_id = $2 AND revoked_at IS NULL`,
          [now, userId],
        );
      }

      return { userExists: true, roleExists: true, assigned: rows.length > 0 };
    });
  }

  async removeUserRole(
    userId: number,
    roleId: number,
    now: Date,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
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
  }

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

  async roleExists(roleId: number): Promise<boolean> {
    const res = await this.dataSource.query(
      `SELECT 1 FROM dori_role WHERE role_id = $1 AND is_active = TRUE`,
      [roleId],
    );
    return res.length > 0;
  }

  async findActivePermissionNames(names: string[]): Promise<string[]> {
    const res = await this.dataSource.query(
      `SELECT permission_name FROM dori_permission
       WHERE permission_name = ANY($1) AND is_active = TRUE`,
      [names],
    );
    return res.map((item: any) => item.permission_name);
  }

  async updateRolePermissions(
    roleId: number,
    permissionNames: string[],
    updaterUserId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM dori_role_permission WHERE role_id = $1`,
        [roleId],
      );

      if (permissionNames.length > 0) {
        await manager.query(
          `INSERT INTO dori_role_permission (role_id, permission_id, assigned_at, assigned_by_user_id)
           SELECT $1, permission_id, $2, $3
           FROM dori_permission
           WHERE permission_name = ANY($4)`,
          [roleId, now, updaterUserId, permissionNames],
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
  }

  async deleteUser(
    userId: number,
    deleterUserId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
         SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
         WHERE user_id = $3`,
        [now, deleterUserId, userId],
      );

      await manager.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'account_deleted'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });
  }
}
