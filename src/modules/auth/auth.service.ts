import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DoriException } from '../../core/errors/dori.exception';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../core/auth/interfaces/jwt-payload.interface';
import { AuthRepository, AuthUserRow } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
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
    const user = await this.authRepository.findActiveUserByUsername(
      loginDto.username,
    );

    if (!user) {
      throw new DoriException('UNAUTHENTICATED');
    }

    // Check temporary lockout (§4.12 & §8.3)
    if (user.locked_until && this.clockService.parse(user.locked_until) > now) {
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
        lockedUntil = this.clockService.addMinutes(now, 15);
      }

      await this.authRepository.recordFailedLogin(
        user.user_id,
        failedAttempts,
        lockedUntil,
        now,
      );

      throw new DoriException('UNAUTHENTICATED');
    }

    // Reset failed attempts on success
    await this.authRepository.recordSuccessfulLogin(user.user_id, now);

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

    const now = this.clockService.now();
    const nextRefreshToken = this.createRefreshToken();
    const expiresDays =
      this.configService.get<number>('jwt.refreshTokenExpiresInDays') || 30;
    const rotation = await this.authRepository.rotateRefreshSession({
      currentTokenHash: this.hashToken(refreshToken),
      nextTokenHash: this.hashToken(nextRefreshToken),
      now,
      expiresAt: this.clockService.addDays(now, expiresDays),
      userAgent,
      ipAddress,
    });

    if (rotation.status !== 'rotated') {
      throw new DoriException('UNAUTHENTICATED');
    }

    const { user, sessionId } = rotation;

    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.user_id,
    );
    const accessToken = this.signAccessToken(
      user,
      roles,
      permissions,
      sessionId,
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
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
      if (!caller.sessionId) {
        throw new DoriException('UNAUTHENTICATED');
      }
      await this.authRepository.revokeSession(caller.sessionId, now, 'logout');
      return { success: true };
    }

    // Cas 2 : userId == caller → global_logout (toutes les sessions du caller)
    if (targetUserId === caller.userId) {
      await this.authRepository.revokeAllSessions(
        caller.userId,
        now,
        'global_logout',
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
    const callerMaxRank = callerRoles.includes('root')
      ? 5
      : await this.authRepository.getMaxRoleRank(caller.userId);

    const targetMaxRank =
      await this.authRepository.getMaxRoleRank(targetUserId);

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
    if (!(await this.authRepository.activeUserExists(targetUserId))) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }

    // Force-disconnect : révoquer toutes les sessions actives de l'utilisateur cible
    await this.authRepository.revokeAllSessions(
      targetUserId,
      now,
      'force_logout',
    );

    return { success: true };
  }

  async getCurrentUser(currentUser: AuthenticatedUser) {
    return this.me(currentUser);
  }

  async me(currentUser: AuthenticatedUser) {
    const user = await this.authRepository.findUserProfile(currentUser.userId);

    if (!user) {
      throw new DoriException('USER_NOT_FOUND');
    }
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
    const user = await this.authRepository.findActiveUserById(userId);

    if (!user) {
      throw new DoriException('USER_NOT_FOUND');
    }
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

    await this.authRepository.changePasswordAndRevokeSessions(
      userId,
      newHash,
      now,
    );

    return { success: true };
  }

  private async getUserRolesAndPermissions(
    userId: number,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    return this.authRepository.getRolesAndPermissions(userId);
  }

  private async generateTokens(
    user: AuthUserRow,
    roles: string[],
    permissions: string[],
    ipAddress?: string,
    userAgent?: string,
  ) {
    const rawRefreshToken = this.createRefreshToken();
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const expiresDays =
      this.configService.get<number>('jwt.refreshTokenExpiresInDays') || 30;
    const now = this.clockService.now();
    const expiresAt = this.clockService.addDays(now, expiresDays);

    // SEC-02 : récupérer le session_id créé pour le lier au payload JWT
    const sessionId = await this.authRepository.createSession(
      user.user_id,
      refreshTokenHash,
      now,
      expiresAt,
      userAgent,
      ipAddress,
    );

    const accessToken = this.signAccessToken(
      user,
      roles,
      permissions,
      sessionId,
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  private createRefreshToken() {
    return `${crypto.randomUUID()}-${crypto.randomBytes(32).toString('hex')}`;
  }

  private signAccessToken(
    user: AuthUserRow,
    roles: string[],
    permissions: string[],
    sessionId: string,
  ) {
    const payload: JwtPayload = {
      sub: user.user_id,
      username: user.username,
      roles,
      permissions,
      userType: user.user_type,
      jti: crypto.randomUUID(),
      sid: sessionId,
    };

    return this.jwtService.sign(payload);
  }
}
