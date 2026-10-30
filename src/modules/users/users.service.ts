import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserDto,
  SetUserPasswordDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserFilterDto,
} from './dto/user.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { UsersRepository } from './users.repository';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { RankService, ROLE_RANK } from '../../core/rbac/services/rank.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
    private readonly rankService: RankService,
  ) {}

  private async getCallerMaxRank(user: AuthenticatedUser): Promise<number> {
    return this.rankService.callerRank(
      user.roles,
      await this.usersRepository.getCallerMaxRank(user.userId),
    );
  }

  private async getUserMaxRank(targetUserId: string): Promise<number> {
    const info = await this.usersRepository.getUserMaxRank(targetUserId);
    if (!info.exists) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    return this.rankService.userRank(info.maxRank, info.userType);
  }

  private async getCallerMaxManageRank(
    user: AuthenticatedUser,
  ): Promise<number> {
    if (user.roles?.includes('root')) {
      return ROLE_RANK.root;
    }

    const permsRes = await this.usersRepository.getUserPermissionNames(
      user.userId,
    );
    const permissions = new Set<string>([
      ...(user.permissions || []),
      ...permsRes,
    ]);

    if (
      permissions.has('system_manage') ||
      permissions.has('user_manage_admin')
    ) {
      return ROLE_RANK.admin;
    }
    if (permissions.has('user_manage_manager')) {
      return ROLE_RANK.manager;
    }
    if (permissions.has('user_manage_operator')) {
      return ROLE_RANK.operator;
    }
    if (permissions.has('user_manage_kiosk')) {
      return ROLE_RANK.kiosk;
    }

    return 0;
  }

  private async checkAntiEscalation(
    caller: AuthenticatedUser,
    targetUserId?: string,
    targetRoleId?: string,
  ): Promise<void> {
    if (caller.roles?.includes('root')) {
      return;
    }

    const callerRank = await this.getCallerMaxRank(caller);

    if (
      callerRank < ROLE_RANK.manager ||
      caller.roles?.includes('operator') ||
      caller.roles?.includes('kiosk')
    ) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    const callerMaxManagePerm = await this.getCallerMaxManageRank(caller);
    const maxManageRank = this.rankService.maximumManageableRank(
      callerRank,
      caller.roles,
      callerMaxManagePerm,
    );

    if (targetUserId && caller.userId !== targetUserId) {
      const targetRank = await this.getUserMaxRank(targetUserId);

      if (targetRank > maxManageRank) {
        if (targetRank >= callerRank) {
          throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
        }
        throw new DoriException('FORBIDDEN_PERMISSION');
      }
    }

    if (targetRoleId) {
      const roleRank = await this.usersRepository.getRoleRank(targetRoleId);
      if (roleRank !== null) {
        if (roleRank > maxManageRank) {
          if (roleRank >= callerRank) {
            throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
          }
          throw new DoriException('FORBIDDEN_PERMISSION');
        }
      }
    }
  }

  async findUsers(filter: UserFilterDto, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    const siteIds = filter.siteIds
      ? [...new Set(filter.siteIds.split(',').map((item) => item.trim()))]
      : undefined;
    return this.usersRepository.findUsers(filter, scope, siteIds);
  }

  async findUserById(userId: string, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    const targetUser = await this.usersRepository.findUserById(userId);

    if (!targetUser) {
      throw new DoriException('USER_NOT_FOUND', { userId });
    }

    if (!scope.isGlobal && user.userId !== userId) {
      const isTargetAdminOrRoot = targetUser.roles.some((r) =>
        ['admin', 'root'].includes(r.role_name),
      );

      if (scope.siteIds.length === 0) {
        if (!isTargetAdminOrRoot) {
          throw new DoriException('USER_NOT_FOUND', { userId });
        }
      } else {
        const hasCommonSite = targetUser.sites.some((s) =>
          scope.siteIds.includes(s.site_id),
        );
        const hasCommonQueueSite = targetUser.queues.some((q) =>
          scope.siteIds.includes(q.site_id),
        );
        if (!isTargetAdminOrRoot && !hasCommonSite && !hasCommonQueueSite) {
          throw new DoriException('USER_NOT_FOUND', { userId });
        }
      }
    }

    return targetUser;
  }

  async createUser(dto: CreateUserDto, user: AuthenticatedUser) {
    if (dto.roleId) {
      await this.checkAntiEscalation(user, undefined, dto.roleId);
    } else {
      await this.checkAntiEscalation(user);
    }

    const saltRounds =
      this.configService.get<number>('security.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const now = this.clockService.now();

    const newUser = await this.usersRepository.createUser({
      username: dto.username,
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      userType: dto.userType,
      languagePreference: dto.languagePreference,
      roleId: dto.roleId,
      creatorUserId: user.userId,
      now,
    });

    if (!newUser) {
      throw new DoriException('ROLE_NOT_FOUND');
    }

    return newUser;
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    const updated = await this.usersRepository.updateUser(
      userId,
      dto,
      user.userId,
      now,
    );
    if (dto.isActive !== undefined) {
      this.scopeService.invalidateUserScope(userId);
    }
    return updated;
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    await this.usersRepository.updateUserStatus(
      userId,
      dto.isActive,
      user.userId,
      now,
    );

    this.scopeService.invalidateUserScope(userId);

    return { userId, isActive: dto.isActive };
  }

  async setUserPassword(
    userId: string,
    dto: SetUserPasswordDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const saltRounds =
      this.configService.get<number>('security.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);
    const now = this.clockService.now();

    await this.usersRepository.setUserPassword(
      userId,
      passwordHash,
      user.userId,
      now,
    );

    return { userId, passwordUpdated: true };
  }

  async assignUserRole(
    userId: string,
    roleId: string,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);
    await this.scopeService.checkUserAccess(user, userId);
    const now = this.clockService.now();

    const result = await this.usersRepository.assignUserRole(
      userId,
      roleId,
      user.userId,
      now,
    );

    if (!result.userExists) {
      throw new DoriException('USER_NOT_FOUND', { userId });
    }
    if (!result.roleExists) {
      throw new DoriException('ROLE_NOT_FOUND', { roleId });
    }

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, assigned: result.assigned };
  }

  async removeUserRole(
    userId: string,
    roleId: string,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);
    await this.scopeService.checkUserAccess(user, userId);

    const now = this.clockService.now();
    const removed = await this.usersRepository.removeUserRole(
      userId,
      roleId,
      now,
    );

    this.scopeService.invalidateUserScope(userId);
    return { userId, roleId, removed };
  }

  getRoles(pagination: PaginationDto) {
    return this.usersRepository.getRoles(pagination);
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    user: AuthenticatedUser,
  ) {
    const roleExists = await this.usersRepository.roleExists(roleId);
    if (!roleExists) {
      throw new DoriException('ROLE_NOT_FOUND', { roleId });
    }

    const requested = Array.from(new Set(dto.permissionNames || []));
    if (requested.length > 0) {
      const foundPermissions =
        await this.usersRepository.findActivePermissionNames(requested);
      const foundSet = new Set(foundPermissions);
      const unknown = requested.filter((name) => !foundSet.has(name));
      if (unknown.length > 0) {
        throw new DoriException('PERMISSION_NOT_FOUND', {
          permissions: unknown,
        });
      }
    }

    const now = this.clockService.now();
    await this.usersRepository.updateRolePermissions(
      roleId,
      requested,
      user.userId,
      now,
    );

    await this.scopeService.clearAllScopeCache();
    return { roleId, permissionsUpdated: true };
  }

  async deleteUser(userId: string, user: AuthenticatedUser) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    await this.usersRepository.deleteUser(userId, user.userId, now);

    this.scopeService.invalidateUserScope(userId);
    return { userId, deleted: true };
  }
}
