import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  SetUserPasswordDto,
  AssignUserRoleDto,
  UpdateRolePermissionsDto,
  UserFilterDto,
} from './dto/user.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import {
  RequirePermission,
  RequireAnyPermission,
} from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('api/v1')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
    'system_manage',
  )
  async findUsers(
    @Query() filter: UserFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findUsers(filter, user);
  }

  @Post('users')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.createUser(dto, user);
  }

  @Get('users/:userId')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
    'system_manage',
  )
  async findUserById(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findUserById(userId, user);
  }

  @Patch('users/:userId')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  async updateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateUser(userId, dto, user);
  }

  @Patch('users/:userId/status')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  async updateUserStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateUserStatus(userId, dto, user);
  }

  @Patch('users/:userId/password')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  async setUserPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.setUserPassword(userId, dto, user);
  }

  @Post('users/:userId/roles')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  @HttpCode(HttpStatus.CREATED)
  async assignUserRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: AssignUserRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.assignUserRole(userId, body.roleId, user);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  async removeUserRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.removeUserRole(userId, roleId, user);
  }

  // Roles and Permissions (§5.9)
  @Get('roles')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
    'system_manage',
  )
  async getRoles(@Query() pagination: PaginationDto) {
    return this.usersService.getRoles(pagination);
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermission('system_manage')
  async updateRolePermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateRolePermissions(roleId, dto, user);
  }
}
