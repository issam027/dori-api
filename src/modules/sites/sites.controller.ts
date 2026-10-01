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
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto, AssignManagerDto } from './dto/update-site.dto';
import {
  SiteDetailResponseDto,
  PaginatedSiteResponseDto,
  SiteDeleteResponseDto,
  SiteManagerResponseDto,
  PaginatedSiteManagerResponseDto,
  AssignManagerResponseDto,
} from './dto/site-response.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Sites')
@ApiBearerAuth('bearer')
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
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findSites(pagination, user);
  }

  @Post()
  @RequirePermission('site_create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouveau site',
    description:
      'Crée un nouveau site avec ses paramètres horaires, de fuseau horaire et de tolérance.',
  })
  @ApiDoriCreatedResponse(SiteDetailResponseDto, 'Site créé avec succès')
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
  @ApiDoriOkResponse(SiteDetailResponseDto, 'Détails du site')
  async findSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findSiteById(siteId, user);
  }

  @Patch(':siteId')
  @RequirePermission('site_edit')
  @ApiOperation({
    summary: 'Modifier un site',
    description:
      'Met à jour la configuration générale, les horaires ou les poids de priorité du site.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(SiteDetailResponseDto, 'Site mis à jour avec succès')
  async updateSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() updateSiteDto: UpdateSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.updateSite(siteId, updateSiteDto, user);
  }

  @Delete(':siteId')
  @RequirePermission('site_delete')
  @ApiOperation({
    summary: 'Désactiver (supprimer) un site',
    description: 'Désactive logiquement le site et ses files associées.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(SiteDeleteResponseDto, 'Site désactivé avec succès')
  async deleteSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.deleteSite(siteId, user);
  }

  @Get(':siteId/managers')
  @RequirePermission('site_view')
  @ApiOperation({
    summary: "Lister les managers d'un site",
    description:
      'Retourne la liste paginée des utilisateurs affectés comme managers à ce site.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriOkResponse(PaginatedSiteManagerResponseDto, 'Liste paginée des managers du site')
  async getManagers(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.findSiteManagers(siteId, pagination, user);
  }

  @Post(':siteId/managers')
  @RequirePermission('user_site_assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Affecter un manager au site',
    description: 'Associe un utilisateur au périmètre de gestion de ce site.',
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriCreatedResponse(AssignManagerResponseDto, 'Manager affecté avec succès')
  async assignManager(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() body: AssignManagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.assignManager(siteId, body.userId, user);
  }

  @Delete(':siteId/managers/:userId')
  @RequirePermission('user_site_assign')
  @ApiOperation({
    summary: 'Retirer un manager du site',
    description: "Supprime l'association d'un utilisateur au site.",
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur à retirer",
  })
  @ApiDoriOkResponse(AssignManagerResponseDto, 'Manager retiré avec succès')
  async removeManager(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sitesService.removeManager(siteId, userId, user);
  }
}
