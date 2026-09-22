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
import { ServiceTiersService } from './service-tiers.service';
import {
  CreateTierDto,
  UpdateTierDto,
  AssociateQueueTierDto,
  UpdateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './dto/tier.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  GlobalTierResponseDto,
  NotificationRuleResponseDto,
  QueueTierResponseDto,
  QueueDisplayScreenResponseDto,
} from './dto/tier-response.dto';

@ApiTags('Forfaits de service & Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ServiceTiersController {
  constructor(private readonly serviceTiersService: ServiceTiersService) {}

  // ---------------------------------------------------------------------------
  // Catalogue Global (§5.5)
  // ---------------------------------------------------------------------------
  @Get('tiers')
  @RequirePermission('tier_view')
  @ApiOperation({ summary: 'Catalogue global des forfaits (paginé)' })
  @ApiStandardResponse({
    type: GlobalTierResponseDto,
    isPaginated: true,
    description: 'Liste paginée des forfaits du catalogue global',
  })
  async findAllTiers(@Query() pagination: PaginationQueryDto) {
    return this.serviceTiersService.findAllTiers(pagination);
  }

  @Post('tiers')
  @RequirePermission('tier_catalog_manage')
  @ApiOperation({ summary: 'Créer un forfait dans le catalogue global' })
  @ApiStandardResponse({
    type: GlobalTierResponseDto,
    status: HttpStatus.CREATED,
    description: 'Forfait créé dans le catalogue global',
  })
  async createTier(@Body() dto: CreateTierDto) {
    return this.serviceTiersService.createTier(dto);
  }

  @Get('tiers/:tierId')
  @RequirePermission('tier_view')
  @ApiOperation({ summary: "Détails d'un forfait global" })
  @ApiStandardResponse({
    type: GlobalTierResponseDto,
    description: "Informations d'un forfait global",
  })
  async findTierById(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.serviceTiersService.findTierById(tierId);
  }

  @Patch('tiers/:tierId')
  @RequirePermission('tier_catalog_manage')
  @ApiOperation({ summary: "Modifier un forfait global" })
  @ApiStandardResponse({
    type: GlobalTierResponseDto,
    description: 'Forfait global mis à jour',
  })
  async updateTier(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateTierDto,
  ) {
    return this.serviceTiersService.updateTier(tierId, dto);
  }

  @Delete('tiers/:tierId')
  @RequirePermission('tier_catalog_manage')
  @ApiOperation({ summary: 'Supprimer un forfait global (refusé si is_system)' })
  @ApiStandardResponse({
    type: GlobalTierResponseDto,
    description: 'Forfait global désactivé',
  })
  async deleteTier(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.serviceTiersService.deleteTier(tierId);
  }

  // ---------------------------------------------------------------------------
  // Associations Queue <-> Tier (§5.5)
  // ---------------------------------------------------------------------------
  @Get('queues/:queueId/tiers')
  @RequirePermission('tier_view')
  @ApiOperation({ summary: 'Forfaits proposés par une file (prix, devise, règles)' })
  @ApiStandardResponse({
    type: QueueTierResponseDto,
    isArray: true,
    description: 'Forfaits et règles de notification appliqués à cette file',
  })
  async findTiersByQueue(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.serviceTiersService.findTiersByQueue(user, queueId);
  }

  @Post('queues/:queueId/tiers')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Associer un forfait à une file (prix et devise)' })
  @ApiStandardResponse({
    type: QueueTierResponseDto,
    description: 'Forfait associé à la file avec tarif personnalisé',
  })
  async associateTierToQueue(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: AssociateQueueTierDto,
  ) {
    return this.serviceTiersService.associateTierToQueue(user, queueId, dto);
  }

  @Patch('queues/:queueId/tiers/:tierId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Modifier le tarif ou la devise du forfait sur la file' })
  @ApiStandardResponse({
    type: QueueTierResponseDto,
    description: 'Tarif du forfait sur la file modifié',
  })
  async updateQueueTier(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateQueueTierDto,
  ) {
    return this.serviceTiersService.updateQueueTier(user, queueId, tierId, dto);
  }

  @Delete('queues/:queueId/tiers/:tierId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Retirer un forfait de la file (interdit pour free)' })
  @ApiStandardResponse({
    type: QueueTierResponseDto,
    description: 'Forfait retiré de la file',
  })
  async deleteQueueTier(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
  ) {
    return this.serviceTiersService.deleteQueueTier(user, queueId, tierId);
  }

  // ---------------------------------------------------------------------------
  // Règles de notification (§5.5)
  // ---------------------------------------------------------------------------
  @Get('queues/:queueId/tiers/:tierId/notification-rules')
  @RequirePermission('tier_view')
  @ApiOperation({ summary: 'Règles de notification pour un forfait sur une file' })
  @ApiStandardResponse({
    type: NotificationRuleResponseDto,
    isArray: true,
    description: 'Règles de déclenchement des notifications SMS/Email/Voice',
  })
  async findRulesByQueueTier(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
  ) {
    return this.serviceTiersService.findRulesByQueueTier(user, queueId, tierId);
  }

  @Post('queues/:queueId/tiers/:tierId/notification-rules')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Créer une règle de notification (welcome ou threshold)' })
  @ApiStandardResponse({
    type: NotificationRuleResponseDto,
    status: HttpStatus.CREATED,
    description: 'Règle de notification configurée',
  })
  async createNotificationRule(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: CreateNotificationRuleDto,
  ) {
    return this.serviceTiersService.createNotificationRule(user, queueId, tierId, dto);
  }

  @Patch('queues/:queueId/tiers/:tierId/notification-rules/:ruleId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Modifier une règle de notification' })
  @ApiStandardResponse({
    type: NotificationRuleResponseDto,
    description: 'Règle de notification mise à jour',
  })
  async updateNotificationRule(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() dto: UpdateNotificationRuleDto,
  ) {
    return this.serviceTiersService.updateNotificationRule(user, queueId, tierId, ruleId, dto);
  }

  @Delete('queues/:queueId/tiers/:tierId/notification-rules/:ruleId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({ summary: 'Désactiver une règle de notification' })
  @ApiStandardResponse({
    type: NotificationRuleResponseDto,
    description: 'Règle de notification désactivée',
  })
  async deleteNotificationRule(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ) {
    return this.serviceTiersService.deleteNotificationRule(user, queueId, tierId, ruleId);
  }

  // ---------------------------------------------------------------------------
  // Écran d'affichage salle d'attente (§5.5)
  // ---------------------------------------------------------------------------
  @Get('queues/:queueId/display')
  @ApiOperation({ summary: "Écran d'affichage salle d'attente (anonymisé)" })
  @ApiStandardResponse({
    type: QueueDisplayScreenResponseDto,
    description: "Données temps réel de la salle d'attente (tickets appelés par guichet et prochains tickets)",
  })
  async getDisplay(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.serviceTiersService.getDisplayScreen(user, queueId);
  }
}
