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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto, AssignManagerDto } from './dto/site.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  SiteResponseDto,
  SiteManagerDto,
  SiteManagerAssignmentResponseDto,
} from './dto/site-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @RequirePermission('site_view')
  @ApiOperation({ summary: 'Liste paginée des sites accessibles selon le périmètre' })
  @ApiStandardResponse({
    type: SiteResponseDto,
    isPaginated: true,
    description: 'Liste paginée des sites accessibles',
  })
  async findAll(@CurrentUser() user: UserContext, @Query() pagination: PaginationQueryDto) {
    return this.sitesService.findAll(user, pagination);
  }

  @Post()
  @RequirePermission('site_create')
  @ApiOperation({ summary: 'Créer un site' })
  @ApiStandardResponse({
    type: SiteResponseDto,
    status: HttpStatus.CREATED,
    description: 'Site créé avec succès',
  })
  async create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Get(':siteId')
  @RequirePermission('site_view')
  @ApiOperation({ summary: "Détails d'un site" })
  @ApiStandardResponse({
    type: SiteResponseDto,
    description: "Informations et configuration par défaut du site",
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
  ) {
    return this.sitesService.findById(user, siteId);
  }

  @Patch(':siteId')
  @RequirePermission('site_edit')
  @ApiOperation({ summary: "Mettre à jour un site" })
  @ApiStandardResponse({
    type: SiteResponseDto,
    description: 'Site mis à jour',
  })
  async update(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(user, siteId, dto);
  }

  @Delete(':siteId')
  @RequirePermission('site_delete')
  @ApiOperation({ summary: 'Désactiver un site (soft delete)' })
  @ApiStandardResponse({
    type: SiteResponseDto,
    description: 'Site désactivé (soft delete avec propagation aux files)',
  })
  async delete(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
  ) {
    return this.sitesService.delete(user, siteId);
  }

  @Get(':siteId/managers')
  @RequirePermission('user_site_assign')
  @ApiOperation({ summary: "Liste des managers affectés au site" })
  @ApiStandardResponse({
    type: SiteManagerDto,
    isArray: true,
    description: 'Liste des utilisateurs ayant le rôle gestionnaire sur ce site',
  })
  async getManagers(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
  ) {
    return this.sitesService.getManagers(user, siteId);
  }

  @Post(':siteId/managers')
  @RequirePermission('user_site_assign')
  @ApiOperation({ summary: 'Affecter un manager au site' })
  @ApiStandardResponse({
    type: SiteManagerAssignmentResponseDto,
    description: 'Manager assigné au site',
  })
  async assignManager(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() dto: AssignManagerDto,
  ) {
    return this.sitesService.assignManager(user, siteId, dto.userId);
  }

  @Delete(':siteId/managers/:userId')
  @RequirePermission('user_site_assign')
  @ApiOperation({ summary: 'Retirer un manager du site' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Affectation du manager supprimée',
  })
  async unassignManager(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.sitesService.unassignManager(user, siteId, userId);
  }
}
