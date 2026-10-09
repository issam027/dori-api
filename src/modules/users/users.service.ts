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

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
  ) {}

  private async getCallerMaxRank(user: AuthenticatedUser): Promise<number> {
    if (user.roles?.includes('root')) {
      return 5;
    }
    return this.usersRepository.getCallerMaxRank(user.userId);
  }

  private async getUserMaxRank(targetUserId: number): Promise<number> {
    const info = await this.usersRepository.getUserMaxRank(targetUserId);
    if (!info.exists) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    if (info.maxRank > 0) return info.maxRank;
    if (info.userType === 'kiosk') return 1;
    return 0;
  }

  private async getCallerMaxManageRank(
    user: AuthenticatedUser,
  ): Promise<number> {
    if (user.roles?.includes('root')) {
      return 5;
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
  ): Promise<void> {
    if (caller.roles?.includes('root')) {
      return;
    }

    const callerRank = await this.getCallerMaxRank(caller);

    if (
      callerRank < 3 ||
      caller.roles?.includes('hotesse') ||
      caller.roles?.includes('kiosk')
    ) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    let maxManageRank = 2;
    if (callerRank >= 4 || caller.roles?.includes('admin')) {
      maxManageRank = 3;
    }

    const callerMaxManagePerm = await this.getCallerMaxManageRank(caller);
    if (callerMaxManagePerm > 0 && callerMaxManagePerm < maxManageRank) {
      maxManageRank = callerMaxManagePerm;
    }

    if (targetUserId) {
      if (caller.userId === targetUserId) {
        return;
      }

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
    return this.usersRepository.findUsers(filter, scope);
  }

  async findUserById(userId: number, user: AuthenticatedUser) {
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
    userId: number,
    dto: UpdateUserDto,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    return this.usersRepository.updateUser(userId, dto, user.userId, now);
  }

  async updateUserStatus(
    userId: number,
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
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);
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
    userId: number,
    roleId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkAntiEscalation(user, userId, roleId);

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
    roleId: number,
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

    this.scopeService.clearAllScopeCache();
    return { roleId, permissionsUpdated: true };
  }

  async deleteUser(userId: number, user: AuthenticatedUser) {
    await this.checkAntiEscalation(user, userId);
    await this.findUserById(userId, user);

    const now = this.clockService.now();
    await this.usersRepository.deleteUser(userId, user.userId, now);

    this.scopeService.invalidateUserScope(userId);
    return { userId, deleted: true };
  }
}
