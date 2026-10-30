import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserSessionRevocationReason } from './entities/user-session.entity';

export interface AuthUserRow {
  user_id: string;
  username: string;
  full_name?: string | null;
  email?: string | null;
  password_hash: string;
  user_type: 'human' | 'kiosk';
  language_preference?: string | null;
  last_login?: Date | string | null;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: Date | string | null;
}

export interface UserSessionRow {
  session_id: string;
  user_id: string;
  expires_at: Date | string;
  revoked_at?: Date | string | null;
}

export type RefreshRotationResult =
  | { status: 'invalid' }
  | { status: 'reused' }
  | { status: 'rotated'; user: AuthUserRow; sessionId: string };

@Injectable()
export class AuthRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findActiveUserByUsername(usernameOrEmail: string) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT user_id, username, full_name, email, password_hash, user_type,
              language_preference, last_login, must_change_password,
              failed_attempts, locked_until
       FROM dorify.dori_user
       WHERE (username = $1 OR LOWER(email) = LOWER($1))
         AND is_active = TRUE AND deleted_at IS NULL
       ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [usernameOrEmail],
    );
    return rows[0] ?? null;
  }

  async findActiveUserById(userId: string) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT user_id, username, full_name, email, password_hash, user_type,
              language_preference, last_login, must_change_password,
              failed_attempts, locked_until
       FROM dorify.dori_user WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findUserProfile(userId: string) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT user_id, username, full_name, email, user_type, language_preference, last_login, must_change_password
       FROM dorify.dori_user WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  recordFailedLogin(
    userId: string,
    maxFailedAttempts: number,
    lockoutMinutes: number,
    now: Date,
  ) {
    return this.dataSource.query(
      `UPDATE dorify.dori_user
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE
             WHEN failed_attempts + 1 >= $1
               THEN GREATEST(locked_until, $3::timestamptz + $2 * INTERVAL '1 minute')
             ELSE locked_until
           END,
           updated_at = $3
       WHERE user_id = $4 AND is_active = TRUE AND deleted_at IS NULL`,
      [maxFailedAttempts, lockoutMinutes, now, userId],
    );
  }

  recordSuccessfulLogin(userId: string, now: Date) {
    return this.dataSource.query(
      `UPDATE dorify.dori_user
       SET failed_attempts = 0, locked_until = NULL, last_login = $1, updated_at = $1
       WHERE user_id = $2`,
      [now, userId],
    );
  }

  rotateRefreshSession(input: {
    currentTokenHash: string;
    nextTokenHash: string;
    now: Date;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshRotationResult> {
    return this.dataSource.transaction(async (manager) => {
      const sessions = await manager.query<UserSessionRow[]>(
        `SELECT session_id, user_id, expires_at, revoked_at
         FROM dorify.dori_user_session
         WHERE refresh_token_hash = $1
         FOR UPDATE`,
        [input.currentTokenHash],
      );
      const session = sessions[0];
      if (!session) return { status: 'invalid' };

      if (session.revoked_at) {
        await manager.query(
          `UPDATE dorify.dori_user_session
           SET revoked_at = $1, revoked_reason = 'rotation'
           WHERE user_id = $2 AND revoked_at IS NULL`,
          [input.now, session.user_id],
        );
        return { status: 'reused' };
      }

      if (new Date(session.expires_at).getTime() <= input.now.getTime()) {
        return { status: 'invalid' };
      }

      const users = await manager.query<AuthUserRow[]>(
        `SELECT user_id, username, full_name, email, password_hash, user_type,
                language_preference, last_login, must_change_password,
                failed_attempts, locked_until
         FROM dorify.dori_user
         WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL
         FOR SHARE`,
        [session.user_id],
      );
      const user = users[0];
      if (!user) return { status: 'invalid' };

      const revoked = await manager.query<Array<{ session_id: string }>>(
        `UPDATE dorify.dori_user_session
         SET revoked_at = $1, revoked_reason = 'rotation'
         WHERE session_id = $2 AND revoked_at IS NULL
         RETURNING session_id`,
        [input.now, session.session_id],
      );
      if (revoked.length === 0) return { status: 'reused' };

      const inserted = await manager.query<Array<{ session_id: string }>>(
        `INSERT INTO dorify.dori_user_session
         (user_id, refresh_token_hash, issued_at, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING session_id`,
        [
          user.user_id,
          input.nextTokenHash,
          input.now,
          input.expiresAt,
          input.userAgent || null,
          input.ipAddress || null,
        ],
      );

      return {
        status: 'rotated',
        user,
        sessionId: inserted[0].session_id,
      };
    });
  }

  revokeAllSessions(
    userId: string,
    now: Date,
    reason: UserSessionRevocationReason,
  ) {
    return this.dataSource.query(
      `UPDATE dorify.dori_user_session
       SET revoked_at = $1, revoked_reason = $2
       WHERE user_id = $3 AND revoked_at IS NULL`,
      [now, reason, userId],
    );
  }

  revokeSession(
    sessionId: string,
    now: Date,
    reason: UserSessionRevocationReason,
  ) {
    return this.dataSource.query(
      `UPDATE dorify.dori_user_session
       SET revoked_at = $1, revoked_reason = $2
       WHERE session_id = $3 AND revoked_at IS NULL`,
      [now, reason, sessionId],
    );
  }

  async getMaxRoleRank(userId: string) {
    const rows = await this.dataSource.query<
      Array<{ max_rank: number | null }>
    >(
      `SELECT MAX(r.rank) as max_rank
       FROM dorify.dori_user_role ur
       JOIN dorify.dori_role r ON r.role_id = ur.role_id AND r.is_active = TRUE
       WHERE ur.user_id = $1`,
      [userId],
    );
    return Number(rows[0]?.max_rank ?? 0);
  }

  async activeUserExists(userId: string) {
    const rows = await this.dataSource.query<Array<{ user_id: string }>>(
      `SELECT user_id FROM dorify.dori_user
       WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [userId],
    );
    return rows.length > 0;
  }

  async getRolesAndPermissions(userId: string) {
    const roleRows = await this.dataSource.query<Array<{ role_name: string }>>(
      `SELECT r.role_name, r.rank
       FROM dorify.dori_user_role ur
       JOIN dorify.dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = TRUE`,
      [userId],
    );
    const roles = roleRows.map(({ role_name }) => role_name);

    const permissionRows = roles.includes('root')
      ? await this.dataSource.query<Array<{ permission_name: string }>>(
          `SELECT permission_name FROM dorify.dori_permission WHERE is_active = TRUE`,
        )
      : await this.dataSource.query<Array<{ permission_name: string }>>(
          `SELECT DISTINCT p.permission_name
           FROM dorify.dori_user_role ur
           JOIN dorify.dori_role r ON r.role_id = ur.role_id AND r.is_active = TRUE
           JOIN dorify.dori_role_permission rp ON rp.role_id = ur.role_id
           JOIN dorify.dori_permission p ON p.permission_id = rp.permission_id
           WHERE ur.user_id = $1 AND p.is_active = TRUE`,
          [userId],
        );

    return {
      roles,
      permissions: permissionRows.map(({ permission_name }) => permission_name),
    };
  }

  async createSession(
    userId: string,
    refreshTokenHash: string,
    issuedAt: Date,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const rows = await this.dataSource.query<Array<{ session_id: string }>>(
      `INSERT INTO dorify.dori_user_session
       (user_id, refresh_token_hash, issued_at, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING session_id`,
      [
        userId,
        refreshTokenHash,
        issuedAt,
        expiresAt,
        userAgent || null,
        ipAddress || null,
      ],
    );
    return rows[0].session_id;
  }

  changePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    now: Date,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dorify.dori_user
         SET password_hash = $1, password_changed_at = $2,
             must_change_password = FALSE, updated_at = $2
         WHERE user_id = $3`,
        [passwordHash, now, userId],
      );
      await manager.query(
        `UPDATE dorify.dori_user_session
         SET revoked_at = $1, revoked_reason = 'password_changed'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });
  }
}
