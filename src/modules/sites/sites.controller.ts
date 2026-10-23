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
  ApiDoriErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import {
  UpdateSiteDto,
  AssignDirectSiteUserDto,
  DirectSiteUserFilterDto,
  SiteFilterDto,
} from './dto/update-site.dto';
import {
  SiteResponseDto,
  PaginatedSiteResponseDto,
  DeleteSiteResponseDto,
  PaginatedSiteDirectUserResponseDto,
  AssignDirectSiteUserResponseDto,
  RemoveDirectSiteUserResponseDto,
} from './dto/site-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';
import { AuditEvent } from '../../core/audit/audit-event.decorator';

@ApiTags('Sites')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1/sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @RequirePermission('site_view')
  @ApiOperation({
    summary: 'Lister les sites',
    description:
      "Retourne la liste paginée de tous les sites d'accueil accessibles.",
  })
  @ApiDoriOkResponse(PaginatedSiteResponseDto, 'Liste paginée des sites')
  async findSites(
    @Query() pagination: SiteFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findSites(pagination, user);
  }

  @Post()
  @AuditEvent({ action: 'site.create', targetType: 'site' })
  @RequirePermission('site_create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouveau site',
    description:
      'Crée un nouveau site avec ses paramètres horaires, de fuseau horaire et de tolérance.',
  })
  @ApiDoriCreatedResponse(SiteResponseDto, 'Site créé avec succès')
  async createSite(
    @Body() createSiteDto: CreateSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.createSite(createSiteDto, user);
  }

  @Get(':siteId')
  @RequirePermission('site_view')
  @ApiOperation({
    summary: "Détails d'un site",
    description: "Retourne la configuration complète d'un site spécifique.",
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(SiteResponseDto, 'Détails du site')
  async findSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findSiteById(siteId, user);
  }

  @Patch(':siteId')
  @AuditEvent({
    action: 'site.update',
    targetType: 'site',
    targetParam: 'siteId',
  })
  @RequirePermission('site_edit')
  @ApiOperation({
    summary: 'Modifier un site',
    description:
      'Met à jour la configuration générale, les horaires ou les poids de priorité du site. isActive=false désactive aussi toutes ses files. isActive=true réactive uniquement le site ; chaque file doit être réactivée explicitement afin de ne pas remettre en service une file précédemment arrêtée.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(SiteResponseDto, 'Site mis à jour avec succès')
  async updateSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() updateSiteDto: UpdateSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.updateSite(siteId, updateSiteDto, user);
  }

  @Delete(':siteId')
  @AuditEvent({
    action: 'site.delete',
    targetType: 'site',
    targetParam: 'siteId',
  })
  @RequirePermission('site_delete')
  @ApiOperation({
    summary: 'Désactiver (supprimer) un site',
    description:
      'Désactive logiquement le site et toutes ses files associées dans une transaction unique. Une réactivation ultérieure du site ne réactive pas automatiquement les files.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(DeleteSiteResponseDto, 'Site désactivé avec succès')
  async deleteSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.deleteSite(siteId, user);
  }

  @Get(':siteId/direct-users')
  @RequirePermission('site_view')
  @ApiOperation({
    summary: 'Lister les utilisateurs directement affectés à un site',
    description:
      'Retourne uniquement les admins et managers directement affectés à ce site.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(
    PaginatedSiteDirectUserResponseDto,
    'Liste paginée des utilisateurs directs du site',
  )
  async getDirectUsers(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Query() pagination: DirectSiteUserFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findDirectSiteUsers(siteId, pagination, user);
  }

  @Post(':siteId/direct-users')
  @AuditEvent({
    action: 'site.user.assign',
    targetType: 'site',
    targetParam: 'siteId',
    secondaryTargetBodyField: 'userId',
  })
  @RequirePermission('user_site_assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Affecter directement un utilisateur au site',
    description:
      'Associe au site un utilisateur actif ayant le rôle admin ou manager.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriCreatedResponse(
    AssignDirectSiteUserResponseDto,
    'Utilisateur directement affecté avec succès',
  )
  async assignDirectUser(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() body: AssignDirectSiteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.assignDirectSiteUser(siteId, body.userId, user);
  }

  @Delete(':siteId/direct-users/:userId')
  @AuditEvent({
    action: 'site.user.remove',
    targetType: 'site',
    targetParam: 'siteId',
    secondaryTargetParam: 'userId',
  })
  @RequirePermission('user_site_assign')
  @ApiOperation({
    summary: 'Retirer un utilisateur directement affecté au site',
    description: "Supprime l'association d'un utilisateur au site.",
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur à retirer",
  })
  @ApiDoriOkResponse(
    RemoveDirectSiteUserResponseDto,
    'Utilisateur retiré du site avec succès',
  )
  async removeDirectUser(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.removeDirectSiteUser(siteId, userId, user);
  }
}
