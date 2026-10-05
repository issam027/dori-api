import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DoriException } from '../../core/errors/dori.exception';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../core/auth/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly clockService: ClockService,
    private readonly scopeService: ScopeService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(
    loginDto: { username: string; password: string },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const now = this.clockService.now();
    const users = await this.dataSource.query(
      `SELECT * FROM dori_user WHERE username = $1 AND is_active = TRUE`,
      [loginDto.username],
    );

    if (!users || users.length === 0) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const user = users[0];

    // Check temporary lockout (§4.12 & §8.3)
    if (user.locked_until && new Date(user.locked_until) > now) {
      throw new DoriException('ACCOUNT_LOCKED');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      const failedAttempts = (user.failed_attempts || 0) + 1;
      let lockedUntil: Date | null = null;
      if (failedAttempts >= 5) {
        lockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins
      }

      await this.dataSource.query(
        `UPDATE dori_user
         SET failed_attempts = $1, locked_until = $2, updated_at = $3
         WHERE user_id = $4`,
        [failedAttempts, lockedUntil, now, user.user_id],
      );

      throw new DoriException('UNAUTHENTICATED');
    }

    // Reset failed attempts on success
    await this.dataSource.query(
      `UPDATE dori_user
       SET failed_attempts = 0, locked_until = NULL, last_login = $1, updated_at = $1
       WHERE user_id = $2`,
      [now, user.user_id],
    );

    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.user_id,
    );

    const tokens = await this.generateTokens(
      user,
      roles,
      permissions,
      ipAddress,
      userAgent,
    );

    return {
      ...tokens,
      user: {
        userId: user.user_id,
        username: user.username,
        userType: user.user_type,
        roles,
        permissions,
        mustChangePassword: user.must_change_password,
      },
    };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    if (!refreshToken) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const tokenHash = this.hashToken(refreshToken);
    const now = this.clockService.now();

    const sessions = await this.dataSource.query(
      `SELECT * FROM dori_user_session WHERE refresh_token_hash = $1`,
      [tokenHash],
    );

    if (!sessions || sessions.length === 0) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const session = sessions[0];

    // If session is already revoked, treat as breach and revoke ALL user sessions (§7.5)
    if (session.revoked_at) {
      await this.dataSource.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'rotation'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, session.user_id],
      );
      throw new DoriException('UNAUTHENTICATED');
    }

    if (new Date(session.expires_at) <= now) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const users = await this.dataSource.query(
      `SELECT * FROM dori_user WHERE user_id = $1 AND is_active = TRUE`,
      [session.user_id],
    );

    if (!users || users.length === 0) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const user = users[0];

    // Mark current session revoked with rotation
    await this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'rotation'
       WHERE session_id = $2`,
      [now, session.session_id],
    );

    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.user_id,
    );
    const tokens = await this.generateTokens(
      user,
      roles,
      permissions,
      ipAddress,
      userAgent,
    );

    return {
      ...tokens,
      user: {
        userId: user.user_id,
        username: user.username,
        userType: user.user_type,
        roles,
        permissions,
      },
    };
  }

  /**
   * BUG2 — Mécanisme de logout révisé :
   *   - Aucun body       → révoque uniquement la session courante du caller (sessionId du JWT)
   *   - body.userId == caller.userId → global_logout : révoque TOUTES les sessions du caller
   *   - body.userId != caller.userId → force-disconnect d'un autre user :
   *       nécessite d'être manager/admin/root et de passer le contrôle hiérarchique
   */
  async logout(caller: AuthenticatedUser, logoutDto?: { userId?: number }) {
    const now = this.clockService.now();
    const targetUserId = logoutDto?.userId;

    // Cas 1 : Aucun userId fourni → déconnexion de la session courante uniquement
    if (targetUserId === undefined || targetUserId === null) {
      await this.dataSource.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'logout'
         WHERE session_id = $2 AND revoked_at IS NULL`,
        [now, caller.sessionId],
      );
      return { success: true };
    }

    // Cas 2 : userId == caller → global_logout (toutes les sessions du caller)
    if (targetUserId === caller.userId) {
      await this.dataSource.query(
        `UPDATE dori_user_session
         SET revoked_at = $1, revoked_reason = 'global_logout'
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, caller.userId],
      );
      return { success: true };
    }

    // Cas 3 : userId != caller → force-disconnect, vérification hiérarchique
    // Seuls les managers, admins et root peuvent déconnecter un autre utilisateur
    const callerRoles: string[] = caller.roles || [];
    const canForceDisconnect =
      callerRoles.includes('root') ||
      callerRoles.includes('admin') ||
      callerRoles.includes('manager');

    if (!canForceDisconnect) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    // Vérification hiérarchique : le caller ne peut pas déconnecter un user de rang >= le sien
    const callerRankRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [caller.userId],
    );
    const callerMaxRank = callerRoles.includes('root')
      ? 5
      : Number(callerRankRes[0]?.max_rank || 0);

    const targetRankRes = await this.dataSource.query(
      `SELECT MAX(r.rank) as max_rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [targetUserId],
    );
    const targetMaxRank = Number(targetRankRes[0]?.max_rank || 0);

    // Un manager (rank 3) ne peut déconnecter que des users de rang < 3 (hôtesse, kiosk)
    // Un admin (rank 4) peut déconnecter jusqu'au rang 3 (manager)
    const maxDisconnectableRank = callerMaxRank - 1;
    if (
      targetMaxRank >= callerMaxRank ||
      targetMaxRank > maxDisconnectableRank
    ) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }

    // Vérifier que l'utilisateur cible existe et est actif
    const targetUsers = await this.dataSource.query(
      `SELECT user_id FROM dori_user WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [targetUserId],
    );
    if (!targetUsers || targetUsers.length === 0) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }

    // Force-disconnect : révoquer toutes les sessions actives de l'utilisateur cible
    await this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'force_logout'
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [now, targetUserId],
    );

    return { success: true };
  }

  async getCurrentUser(currentUser: AuthenticatedUser) {
    return this.me(currentUser);
  }

  async me(currentUser: AuthenticatedUser) {
    const users = await this.dataSource.query(
      `SELECT user_id, username, email, user_type, language_preference, last_login, must_change_password
       FROM dori_user WHERE user_id = $1`,
      [currentUser.userId],
    );

    if (!users || users.length === 0) {
      throw new DoriException('USER_NOT_FOUND');
    }

    const user = users[0];
    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.user_id,
    );
    const scope = await this.scopeService.getUserScope(currentUser);

    return {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      userType: user.user_type,
      languagePreference: user.language_preference,
      lastLogin: user.last_login,
      mustChangePassword: user.must_change_password,
      roles,
      permissions,
      scope,
    };
  }

  async changePassword(
    userOrId: AuthenticatedUser | number,
    dto: { currentPassword: string; newPassword: string },
  ) {
    const userId = typeof userOrId === 'number' ? userOrId : userOrId.userId;
    const users = await this.dataSource.query(
      `SELECT * FROM dori_user WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    if (!users || users.length === 0) {
      throw new DoriException('USER_NOT_FOUND');
    }

    const user = users[0];
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.password_hash,
    );
    if (!matches) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const saltRounds =
      this.configService.get<number>('security.bcryptRounds') || 12;
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_user
       SET password_hash = $1, password_changed_at = $2, must_change_password = FALSE, updated_at = $2
       WHERE user_id = $3`,
      [newHash, now, userId],
    );

    // Revoke all sessions on password change (§4.12)
    await this.dataSource.query(
      `UPDATE dori_user_session
       SET revoked_at = $1, revoked_reason = 'password_changed'
       WHERE user_id = $2 AND revoked_at IS NULL`,
      [now, userId],
    );

    return { success: true };
  }

  private async getUserRolesAndPermissions(
    userId: number,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const rolesRes = await this.dataSource.query(
      `SELECT r.role_name, r.rank
       FROM dori_user_role ur
       JOIN dori_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = TRUE`,
      [userId],
    );

    const roles: string[] = rolesRes.map((r: any) => r.role_name);

    let permissions: string[] = [];
    if (roles.includes('root')) {
      const allPerms = await this.dataSource.query(
        `SELECT permission_name FROM dori_permission WHERE is_active = TRUE`,
      );
      permissions = allPerms.map((p: any) => p.permission_name);
    } else {
      const permsRes = await this.dataSource.query(
        `SELECT DISTINCT p.permission_name
         FROM dori_user_role ur
         JOIN dori_role_permission rp ON rp.role_id = ur.role_id
         JOIN dori_permission p ON p.permission_id = rp.permission_id
         WHERE ur.user_id = $1 AND p.is_active = TRUE`,
        [userId],
      );
      permissions = permsRes.map((p: any) => p.permission_name);
    }

    return { roles, permissions };
  }

  private async generateTokens(
    user: any,
    roles: string[],
    permissions: string[],
    ipAddress?: string,
    userAgent?: string,
  ) {
    const jti = crypto.randomUUID();

    const rawRefreshToken = `${crypto.randomUUID()}-${crypto.randomBytes(32).toString('hex')}`;
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const expiresDays =
      this.configService.get<number>('jwt.refreshTokenExpiresInDays') || 30;
    const now = this.clockService.now();
    const expiresAt = new Date(
      now.getTime() + expiresDays * 24 * 60 * 60 * 1000,
    );

    // SEC-02 : récupérer le session_id créé pour le lier au payload JWT
    const inserted = await this.dataSource.query(
      `INSERT INTO dori_user_session
       (user_id, refresh_token_hash, issued_at, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING session_id`,
      [
        user.user_id,
        refreshTokenHash,
        now,
        expiresAt,
        userAgent || null,
        ipAddress || null,
      ],
    );

    const sessionId: string = inserted[0].session_id;

    // SEC-02 : inclure sid (session UUID) dans le payload pour la vérification unitaire
    const payload: JwtPayload = {
      sub: user.user_id,
      username: user.username,
      roles,
      permissions,
      userType: user.user_type,
      jti,
      sid: sessionId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
