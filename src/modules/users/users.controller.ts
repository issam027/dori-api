import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  ResetUserPasswordDto,
  AssignRoleDto,
} from './dto/user.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  UserSummaryResponseDto,
  UserDetailResponseDto,
  RoleResponseDto,
  RoleAssignmentResponseDto,
} from './dto/user-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Utilisateurs & Rôles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequirePermission('user_manage_kiosk', 'user_manage_hostess')
  @ApiOperation({ summary: 'Liste paginée des utilisateurs' })
  @ApiQuery({ name: 'userType', required: false, enum: ['human', 'kiosk'] })
  @ApiStandardResponse({
    type: UserSummaryResponseDto,
    isPaginated: true,
    description: 'Liste paginée des utilisateurs avec leurs rôles',
  })
  async findAll(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationQueryDto,
    @Query('userType') userType?: string,
  ) {
    return this.usersService.findAll(user, pagination, userType);
  }

  @Post('users')
  @ApiOperation({ summary: 'Créer un utilisateur (contrainte anti-escalade)' })
  @ApiStandardResponse({
    type: UserDetailResponseDto,
    status: HttpStatus.CREATED,
    description: 'Compte utilisateur créé avec succès',
  })
  async create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(user, dto);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: "Détails d'un utilisateur et ses affectations" })
  @ApiStandardResponse({
    type: UserDetailResponseDto,
    description: `Fiche complète de l'utilisateur avec ses sites et files assignées`,
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.findById(user, userId);
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Mettre à jour le profil utilisateur' })
  @ApiStandardResponse({
    type: UserDetailResponseDto,
    description: 'Profil utilisateur mis à jour',
  })
  async update(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, userId, dto);
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Activer / désactiver un compte (révoque les sessions)' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Statut du compte modifié, sessions révoquées si désactivation',
  })
  async updateStatus(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(user, userId, dto);
  }

  @Patch('users/:userId/password')
  @ApiOperation({ summary: 'Attribuer un mot de passe (force le changement à la connexion)' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: `Mot de passe réinitialisé, l'utilisateur devra le changer à sa prochaine connexion`,
  })
  async resetPassword(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(user, userId, dto);
  }

  @Post('users/:userId/roles')
  @ApiOperation({ summary: 'Attribuer un rôle à un utilisateur' })
  @ApiStandardResponse({
    type: RoleAssignmentResponseDto,
    status: HttpStatus.CREATED,
    description: `Rôle attribué à l'utilisateur (contrainte anti-escalade respectée)`,
  })
  async assignRole(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(user, userId, dto.roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Retirer un rôle à un utilisateur' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: `Rôle retiré de l'utilisateur avec succès`,
  })
  async unassignRole(
    @CurrentUser() user: UserContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.unassignRole(user, userId, roleId);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Liste des rôles et de leurs permissions' })
  @ApiStandardResponse({
    type: RoleResponseDto,
    isArray: true,
    description: 'Catalogue complet des rôles avec leurs permissions associées',
  })
  async findAllRoles() {
    return this.usersService.findAllRoles();
  }
}
