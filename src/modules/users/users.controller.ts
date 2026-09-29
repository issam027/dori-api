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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriCreatedResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  SetUserPasswordDto,
  AssignUserRoleDto,
  UpdateRolePermissionsDto,
  UserFilterDto,
  UserDeleteResponseDto,
} from './dto/user.dto';
import {
  PaginatedUserResponseDto,
  UserDetailResponseDto,
  CreateUserResponseDto,
  UpdateUserResponseDto,
  UpdateUserStatusResponseDto,
  SetUserPasswordResponseDto,
  AssignUserRoleResponseDto,
  RemoveUserRoleResponseDto,
  PaginatedRoleResponseDto,
  UpdateRolePermissionsResponseDto,
} from './dto/user-response.dto';
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
    'session_operate',
    'queue_view',
  )
  @ApiOperation({
    summary: 'Lister les utilisateurs',
    description:
      'Retourne la liste paginée des utilisateurs selon le périmètre et les droits du compte appelant.',
  })
  @ApiDoriOkResponse(PaginatedUserResponseDto, 'Liste paginée des utilisateurs')
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
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description:
      'Crée un nouvel utilisateur (humain ou borne interactive) et lui assigne optionnellement un rôle initial.',
  })
  @ApiDoriCreatedResponse(CreateUserResponseDto, 'Utilisateur créé avec succès')
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
    'session_operate',
    'queue_view',
  )
  @ApiOperation({
    summary: 'Obtenir les détails d’un utilisateur',
    description:
      'Retourne les informations détaillées d’un utilisateur ainsi que ses rôles, sites et files associés.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriOkResponse(UserDetailResponseDto, "Détails de l'utilisateur")
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
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur',
    description:
      'Met à jour les informations de base d’un compte utilisateur (email, préférence linguistique).',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriOkResponse(UpdateUserResponseDto, 'Utilisateur mis à jour avec succès')
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
  @ApiOperation({
    summary: 'Activer ou désactiver un utilisateur',
    description:
      'Met à jour le statut actif du compte utilisateur. La désactivation révoque immédiatement ses sessions actives.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriOkResponse(
    UpdateUserStatusResponseDto,
    'Statut de l’utilisateur mis à jour',
  )
  async updateUserStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateUserStatus(userId, dto, user);
  }

  @Delete('users/:userId')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
    description:
      'Désactive et supprime logiquement un compte utilisateur (soft-delete) et révoque ses sessions actives.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriOkResponse(UserDeleteResponseDto, 'Utilisateur supprimé avec succès')
  async deleteUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.deleteUser(userId, user);
  }

  @Patch('users/:userId/password')
  @RequireAnyPermission(
    'user_manage_kiosk',
    'user_manage_hostess',
    'user_manage_manager',
    'user_manage_admin',
  )
  @ApiOperation({
    summary: 'Définir le mot de passe d’un utilisateur',
    description:
      'Réinitialise le mot de passe d’un utilisateur et révoque l’ensemble de ses sessions actives existantes.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriOkResponse(
    SetUserPasswordResponseDto,
    'Mot de passe mis à jour avec succès',
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
  @ApiOperation({
    summary: 'Assigner un rôle à un utilisateur',
    description:
      'Assigne un nouveau rôle à un compte utilisateur dans la limite des prérogatives du compte appelant.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiDoriCreatedResponse(
    AssignUserRoleResponseDto,
    'Rôle assigné avec succès',
  )
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
  @ApiOperation({
    summary: 'Retirer un rôle à un utilisateur',
    description:
      'Retire un rôle précédemment assigné à un compte utilisateur.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur",
  })
  @ApiParam({
    name: 'roleId',
    type: Number,
    description: 'ID du rôle à retirer',
  })
  @ApiDoriOkResponse(RemoveUserRoleResponseDto, 'Rôle retiré avec succès')
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
  @ApiOperation({
    summary: 'Lister les rôles',
    description:
      'Retourne la liste paginée des rôles système ainsi que leurs permissions associées.',
  })
  @ApiDoriOkResponse(PaginatedRoleResponseDto, 'Liste paginée des rôles')
  async getRoles(@Query() pagination: PaginationDto) {
    return this.usersService.getRoles(pagination);
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermission('system_manage')
  @ApiOperation({
    summary: 'Mettre à jour les permissions d’un rôle',
    description:
      'Remplace l’ensemble des permissions attribuées à un rôle donné (réservé aux administrateurs système).',
  })
  @ApiParam({
    name: 'roleId',
    type: Number,
    description: 'ID du rôle',
  })
  @ApiDoriOkResponse(
    UpdateRolePermissionsResponseDto,
    'Permissions du rôle mises à jour',
  )
  async updateRolePermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateRolePermissions(roleId, dto, user);
  }
}
