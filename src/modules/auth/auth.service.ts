import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/login.dto';
import { JwtPayload } from '../../core/auth/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly clockService: ClockService,
    private readonly scopeService: ScopeService,
  ) {}

  /**
   * Hache un token opaque avec SHA-256 (§3.15, §7.5)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Authentification et émission de tokens (§4.12, §7.5)
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    const now = this.clockService.now();

    // Vérification verrouillage de compte (§4.12)
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new AppException(ErrorCode.UNAUTHENTICATED, {
        lockedUntil: user.lockedUntil.toISOString(),
      });
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      const failedAttempts = user.failedAttempts + 1;
      let lockedUntil: Date | null = null;

      // Verrouillage temporaire après 5 échecs (§4.12, §8.3)
      if (failedAttempts >= 5) {
        lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      }

      await this.prisma.user.update({
        where: { userId: user.userId },
        data: {
          failedAttempts,
          lockedUntil,
        },
      });

      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    // Réinitialisation des échecs après connexion réussie
    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLogin: now,
      },
    });

    // Extraction des rôles et permissions agrégées
    const roles = user.userRoles.map((ur) => ur.role.roleName);
    const permissionSet = new Set<string>();
    user.userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rp) => {
        if (rp.permission.isActive) {
          permissionSet.add(rp.permission.permissionName);
        }
      });
    });
    const permissions = Array.from(permissionSet);

    // Payload JWT selon §7.5
    const payload: JwtPayload = {
      sub: user.userId,
      roles,
      permissions,
      userType: user.userType as 'human' | 'kiosk',
      jti: crypto.randomUUID(),
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '3600s' }); // 60 minutes fixe

    // Émission du refresh token opaque (§3.15, §7.5)
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    await this.prisma.userSession.create({
      data: {
        userId: user.userId,
        refreshTokenHash,
        issuedAt: now,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 3600,
      mustChangePassword: user.mustChangePassword,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        roles,
        permissions,
        userType: user.userType,
      },
    };
  }

  /**
   * Échange du refresh token avec rotation systématique (§7.5)
   */
  async refresh(dto: RefreshTokenDto, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    const now = this.clockService.now();

    // Détection de réutilisation (§7.5) : si le token est déjà révoqué -> compromission suspectée
    if (session.revokedAt !== null) {
      this.logger.warn(`Tentative de réutilisation d'un refresh token révoqué pour userId=${session.userId}`);
      // Révocation de TOUTES les sessions actives du compte
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'admin' },
      });
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    if (session.expiresAt < now || !session.user.isActive) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    // Rotation : révocation de l'ancien token
    await this.prisma.userSession.update({
      where: { sessionId: session.sessionId },
      data: {
        revokedAt: now,
        revokedReason: 'rotation',
      },
    });

    // Émission du nouveau refresh token
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshTokenHash,
        issuedAt: now,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Génération du nouvel access token
    const roles = session.user.userRoles.map((ur) => ur.role.roleName);
    const permissionSet = new Set<string>();
    session.user.userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rp) => {
        if (rp.permission.isActive) {
          permissionSet.add(rp.permission.permissionName);
        }
      });
    });

    const payload: JwtPayload = {
      sub: session.user.userId,
      roles,
      permissions: Array.from(permissionSet),
      userType: session.user.userType as 'human' | 'kiosk',
      jti: crypto.randomUUID(),
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '3600s' });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Déconnexion et révocation de la session (§5.2, §7.5)
   */
  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: {
        revokedAt: this.clockService.now(),
        revokedReason: 'logout',
      },
    });
    return { success: true };
  }

  /**
   * Profil et périmètre de l'utilisateur courant (§5.2)
   */
  async getMe(userContext: UserContext) {
    const user = await this.prisma.user.findUnique({
      where: { userId: userContext.userId },
      select: {
        userId: true,
        username: true,
        email: true,
        userType: true,
        languagePreference: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppException(ErrorCode.UNAUTHENTICATED);
    }

    const allowedSites = await this.scopeService.getAllowedSiteIds(userContext);
    const allowedQueues = await this.scopeService.getAllowedQueueIds(userContext);

    return {
      ...user,
      roles: userContext.roles,
      permissions: userContext.permissions,
      scope: {
        allSites: this.scopeService.isSystemUser(userContext),
        allowedSiteIds: allowedSites,
        allowedQueueIds: allowedQueues,
      },
    };
  }

  /**
   * Changement de mot de passe (§4.12, §5.2)
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) throw new AppException(ErrorCode.UNAUTHENTICATED);

    const isOldPasswordValid = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isOldPasswordValid) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'oldPassword' });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const now = this.clockService.now();

    await this.prisma.user.update({
      where: { userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
      },
    });

    // Révocation de toutes les sessions actives suite au changement de mot de passe (§4.12)
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokedReason: 'password_changed',
      },
    });

    return { success: true };
  }
}
