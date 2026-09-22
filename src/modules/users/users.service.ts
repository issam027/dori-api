import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { ROLE_RANKS, canManageRole } from '../../core/rbac/roles.enum';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  ResetUserPasswordDto,
  AssignRoleDto,
} from './dto/user.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Obtient le rang le plus élevé parmi les rôles d'un utilisateur
   */
  private getMaxRank(roles: string[]): number {
    let max = 0;
    for (const r of roles) {
      const rank = ROLE_RANKS[r] || 0;
      if (rank > max) max = rank;
    }
    return max;
  }

  /**
   * Vérifie la règle anti-escalade (§4.9)
   */
  private async validateAntiEscalation(caller: UserContext, targetUserId?: number, targetRoleName?: string) {
    const isRoot = caller.roles.includes('root');
    if (isRoot) return;

    const callerRank = this.getMaxRank(caller.roles);

    // Vérification du rôle cible demandé
    if (targetRoleName) {
      const targetRank = ROLE_RANKS[targetRoleName] || 0;
      if (!canManageRole(callerRank, targetRank, isRoot)) {
        throw new AppException(ErrorCode.FORBIDDEN_ROLE_ESCALATION);
      }
    }

    // Vérification du rang du compte cible
    if (targetUserId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { userId: targetUserId },
        include: { userRoles: { include: { role: true } } },
      });
      if (targetUser) {
        const targetUserRoles = targetUser.userRoles.map((ur) => ur.role.roleName);
        const targetMaxRank = this.getMaxRank(targetUserRoles);
        if (!canManageRole(callerRank, targetMaxRank, isRoot)) {
          throw new AppException(ErrorCode.FORBIDDEN_ROLE_ESCALATION);
        }
      }
    }
  }

  async findAll(user: UserContext, pagination: PaginationQueryDto, userType?: string) {
    const whereClause: any = { isActive: true };
    if (userType) whereClause.userType = userType;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.take,
        select: {
          userId: true,
          username: true,
          email: true,
          userType: true,
          isActive: true,
          languagePreference: true,
          lastLogin: true,
          createdAt: true,
          userRoles: { include: { role: true } },
        },
        orderBy: { userId: 'asc' },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    const items = users.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role.roleName),
      userRoles: undefined,
    }));

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findById(user: UserContext, targetUserId: number) {
    const targetUser = await this.prisma.user.findFirst({
      where: { userId: targetUserId, isActive: true },
      select: {
        userId: true,
        username: true,
        email: true,
        userType: true,
        isActive: true,
        languagePreference: true,
        lastLogin: true,
        createdAt: true,
        userRoles: { include: { role: true } },
        userSites: { include: { site: true } },
        userQueues: { include: { queue: true } },
      },
    });

    if (!targetUser) throw new AppException(ErrorCode.USER_NOT_FOUND, { userId: targetUserId });

    return {
      userId: targetUser.userId,
      username: targetUser.username,
      email: targetUser.email,
      userType: targetUser.userType,
      isActive: targetUser.isActive,
      languagePreference: targetUser.languagePreference,
      lastLogin: targetUser.lastLogin,
      createdAt: targetUser.createdAt,
      roles: targetUser.userRoles.map((ur) => ur.role.roleName),
      assignedSites: targetUser.userSites.map((us) => ({
        siteId: us.site.siteId,
        siteName: us.site.siteName,
      })),
      assignedQueues: targetUser.userQueues.map((uq) => ({
        queueId: uq.queue.queueId,
        queueCode: uq.queue.queueCode,
        queueName: uq.queue.queueName,
      })),
    };
  }

  async create(caller: UserContext, dto: CreateUserDto) {
    await this.validateAntiEscalation(caller, undefined, dto.roleName);

    const role = await this.prisma.role.findUnique({ where: { roleName: dto.roleName } });
    if (!role) throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'roleName' });

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          userType: dto.userType || 'human',
          languagePreference: dto.languagePreference || 'fr',
          createdByUserId: caller.userId,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.userId,
          roleId: role.roleId,
        },
      });

      return {
        userId: newUser.userId,
        username: newUser.username,
        email: newUser.email,
        userType: newUser.userType,
        roles: [role.roleName],
      };
    });
  }

  async update(caller: UserContext, targetUserId: number, dto: UpdateUserDto) {
    await this.validateAntiEscalation(caller, targetUserId);

    return this.prisma.user.update({
      where: { userId: targetUserId },
      data: dto,
      select: {
        userId: true,
        username: true,
        email: true,
        userType: true,
        languagePreference: true,
      },
    });
  }

  /**
   * Désactivation de compte + révocation immédiate de toutes les sessions (§4.12)
   */
  async updateStatus(caller: UserContext, targetUserId: number, dto: UpdateUserStatusDto) {
    await this.validateAntiEscalation(caller, targetUserId);
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { userId: targetUserId },
        data: {
          isActive: dto.isActive,
          deletedAt: dto.isActive ? null : now,
        },
      });

      if (!dto.isActive) {
        // Révocation immédiate de toutes les sessions du compte (§4.12)
        await tx.userSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: {
            revokedAt: now,
            revokedReason: 'account_disabled',
          },
        });
      }

      return { userId: updatedUser.userId, isActive: updatedUser.isActive };
    });
  }

  /**
   * Attribution d'un mot de passe par un tiers + force le changement à la connexion (§4.12)
   */
  async resetPassword(caller: UserContext, targetUserId: number, dto: ResetUserPasswordDto) {
    await this.validateAntiEscalation(caller, targetUserId);
    const now = this.clockService.now();

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { userId: targetUserId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          mustChangePassword: true,
        },
      });

      // Révocation de toutes les sessions actives (§4.12)
      await tx.userSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: 'password_changed',
        },
      });

      return { success: true, mustChangePassword: true };
    });
  }

  async assignRole(caller: UserContext, targetUserId: number, roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { roleId } });
    if (!role) throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'roleId' });

    await this.validateAntiEscalation(caller, targetUserId, role.roleName);

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUserId, roleId } },
      update: {},
      create: { userId: targetUserId, roleId },
    });

    return { success: true, roleId, roleName: role.roleName };
  }

  async unassignRole(caller: UserContext, targetUserId: number, roleId: number) {
    const role = await this.prisma.role.findUnique({ where: { roleId } });
    if (!role) throw new AppException(ErrorCode.VALIDATION_ERROR, { field: 'roleId' });

    await this.validateAntiEscalation(caller, targetUserId, role.roleName);

    await this.prisma.userRole.deleteMany({
      where: { userId: targetUserId, roleId },
    });

    return { success: true };
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      where: { isActive: true },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { rank: 'asc' },
    });
  }
}
