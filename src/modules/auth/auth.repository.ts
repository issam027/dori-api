import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuthUserRow {
  user_id: number;
  username: string;
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
  user_id: number;
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

  async findActiveUserByUsername(username: string) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT * FROM dori_user WHERE username = $1 AND is_active = TRUE`,
      [username],
    );
    return rows[0] ?? null;
  }

  async findActiveUserById(userId: number) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT * FROM dori_user WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async findUserProfile(userId: number) {
    const rows = await this.dataSource.query<AuthUserRow[]>(
      `SELECT user_id, username, email, user_type, language_preference, last_login, must_change_password
       FROM dori_user WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  recordFailedLogin(
    userId: number,
    failedAttempts: number,
    lockedUntil: Date | null,
    now: Date,
  ) {
    return this.dataSource.query(
      `UPDATE dori_user
       SET failed_attempts = $1, locked_until = $2, updated_at = $3
       WHERE user_id = $4`,
      [failedAttempts, lockedUntil, now, userId],
    );
  }

  recordSuccessfulLogin(userId: number, now: Date) {
    return this.dataSource.query(
      `UPDATE dori_user
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
         FROM dori_user_session
         WHERE refresh_token_hash = $1
         FOR UPDATE`,
        [input.currentTokenHash],
      );
      const session = sessions[0];
      if (!session) return { status: 'invalid' };

      if (session.revoked_at) {
        await manager.query(
          `UPDATE dori_user_session
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
        `SELECT * FROM dori_user
         WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL
         FOR SHARE`,
        [session.user_id],
      );
      const user = users[0];
      if (!user) return { status: 'invalid' };

      const revoked = await manager.query<Array<{ session_id: string }>>(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'rotation'
         WHERE session_id = $2 AND revoked_at IS NULL
         RETURNING session_id`,
        [input.now, session.session_id],
      );
      if (revoked.length === 0) return { status: 'reused' };

      const inserted = await manager.query<Array<{ session_id: string }>>(
        `INSERT INTO dori_user_session
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

  revokeAllSessions(userId: number, now: Date, reason: string) {
    return this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = $2
       WHERE user_id = $3 AND revoked_at IS NULL`,
      [now, reason, userId],
    );
  }

  revokeSession(sessionId: string, now: Date, reason: string) {
    return this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = $2
       WHERE session_id = $3 AND revoked_at IS NULL`,
      [now, reason, sessionId],
    );
  }

  async getMaxRoleRank(userId: number) {
    const rows = await this.dataSource.query<
      Array<{ max_rank: number | null }>
    >(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId],
    );
    return Number(rows[0]?.max_rank ?? 0);
  }

  async activeUserExists(userId: number) {
    const rows = await this.dataSource.query<Array<{ user_id: number }>>(
      `SELECT user_id FROM dori_user
       WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [userId],
    );
    return rows.length > 0;
  }

  async getRolesAndPermissions(userId: number) {
    const roleRows = await this.dataSource.query<Array<{ role_name: string }>>(
      `SELECT r.role_name, r.rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = TRUE`,
      [userId],
    );
    const roles = roleRows.map(({ role_name }) => role_name);

    const permissionRows = roles.includes('root')
      ? await this.dataSource.query<Array<{ permission_name: string }>>(
          `SELECT permission_name FROM dori_permission WHERE is_active = TRUE`,
        )
      : await this.dataSource.query<Array<{ permission_name: string }>>(
          `SELECT DISTINCT p.permission_name
           FROM dori_user_role ur
           JOIN dori_role_permission rp ON rp.role_id = ur.role_id
           JOIN dori_permission p ON p.permission_id = rp.permission_id
           WHERE ur.user_id = $1 AND p.is_active = TRUE`,
          [userId],
        );

    return {
      roles,
      permissions: permissionRows.map(({ permission_name }) => permission_name),
    };
  }

  async createSession(
    userId: number,
    refreshTokenHash: string,
    issuedAt: Date,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const rows = await this.dataSource.query<Array<{ session_id: string }>>(
      `INSERT INTO dori_user_session
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
    userId: number,
    passwordHash: string,
    now: Date,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_user
         SET password_hash = $1, password_changed_at = $2,
             must_change_password = FALSE, updated_at = $2
         WHERE user_id = $3`,
        [passwordHash, now, userId],
      );
      await manager.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'password_changed'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId],
      );
    });
  }
}
