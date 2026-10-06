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
import { ServiceTiersService } from './service-tiers.service';
import {
  CreateTierDto,
  UpdateTierDto,
  AssociateQueueTierDto,
  UpdateQueueTierDto,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from './dto/service-tier.dto';
import {
  ServiceTierResponseDto,
  PaginatedServiceTierResponseDto,
  QueueTierResponseDto,
  PaginatedQueueTierResponseDto,
  NotificationRuleResponseDto,
  PaginatedNotificationRuleResponseDto,
  DeleteTierResponseDto,
} from './dto/tier-response.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Tiers')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1')
export class ServiceTiersController {
  constructor(private readonly tiersService: ServiceTiersService) {}

  // 1. Global catalog
  @Get('tiers')
  @RequirePermission('tier_view')
  @ApiOperation({
    summary: 'Catalogue global des forfaits',
    description:
      'Retourne tous les forfaits disponibles au catalogue (Gratuit, Standard, Premium...).',
  })
  @ApiDoriOkResponse(
    PaginatedServiceTierResponseDto,
    'Liste paginée des forfaits du catalogue',
  )
  async findTiers(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.findTiers(pagination, user);
  }

  @Post('tiers')
  @RequirePermission('tier_catalog_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un forfait au catalogue',
    description: 'Ajoute un nouveau type de forfait dans le catalogue système.',
  })
  @ApiDoriCreatedResponse(ServiceTierResponseDto, 'Forfait créé au catalogue')
  async createTier(
    @Body() dto: CreateTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.createTier(dto, user);
  }

  @Get('tiers/:tierId')
  @RequirePermission('tier_view')
  @ApiOperation({
    summary: "Détails d'un forfait",
    description: "Retourne les informations d'un forfait du catalogue.",
  })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(ServiceTierResponseDto, 'Détails du forfait')
  async findTier(
    @Param('tierId', ParseIntPipe) tierId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.findTierById(tierId, user);
  }

  @Patch('tiers/:tierId')
  @RequirePermission('tier_catalog_manage')
  @ApiOperation({
    summary: 'Modifier un forfait du catalogue',
    description:
      "Met à jour le libellé ou la description d'un forfait non système.",
  })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(ServiceTierResponseDto, 'Forfait mis à jour')
  async updateTier(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.updateTier(tierId, dto, user);
  }

  @Delete('tiers/:tierId')
  @RequirePermission('tier_catalog_manage')
  @ApiOperation({
    summary: 'Désactiver un forfait du catalogue',
    description:
      'Désactive le forfait du catalogue (interdit sur les forfaits système).',
  })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(DeleteTierResponseDto, 'Forfait désactivé')
  async deleteTier(
    @Param('tierId', ParseIntPipe) tierId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.deleteTier(tierId, user);
  }

  // 2. Queue-specific tiers
  @Get('queues/:queueId/tiers')
  @RequirePermission('tier_view')
  @ApiOperation({
    summary: 'Forfaits associés à une file',
    description:
      'Retourne la liste paginée des forfaits configurés pour cette file avec leurs tarifs locaux.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    PaginatedQueueTierResponseDto,
    'Liste paginée des forfaits de la file',
  )
  async getQueueTiers(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.findQueueTiers(queueId, pagination, user);
  }

  @Post('queues/:queueId/tiers')
  @RequirePermission('queue_tier_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Associer un forfait à une file',
    description:
      "Définit le prix local et l'activation du forfait pour la file d'attente.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriCreatedResponse(QueueTierResponseDto, 'Forfait associé avec succès')
  async associateTier(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: AssociateQueueTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.associateQueueTier(queueId, dto, user);
  }

  @Patch('queues/:queueId/tiers/:tierId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({
    summary: "Modifier le forfait d'une file",
    description:
      "Modifie le tarif ou l'état par défaut du forfait pour cette file.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(
    QueueTierResponseDto,
    'Configuration du forfait mise à jour',
  )
  async updateQueueTier(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateQueueTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.updateQueueTier(queueId, tierId, dto, user);
  }

  @Delete('queues/:queueId/tiers/:tierId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({
    summary: "Dissocier un forfait d'une file",
    description: "Retire la proposition de ce forfait sur la file d'attente.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(DeleteTierResponseDto, 'Forfait dissocié')
  async removeQueueTier(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.removeQueueTier(queueId, tierId, user);
  }

  // 3. Notification rules
  @Get('queues/:queueId/tiers/:tierId/notification-rules')
  @RequirePermission('tier_view')
  @ApiOperation({
    summary: "Règles de notification d'un forfait",
    description:
      'Liste les déclencheurs automatiques de SMS/email associés à ce forfait sur la file.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriOkResponse(
    PaginatedNotificationRuleResponseDto,
    'Liste paginée des règles de notification',
  )
  async getRules(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.findNotificationRules(
      queueId,
      tierId,
      pagination,
      user,
    );
  }

  @Post('queues/:queueId/tiers/:tierId/notification-rules')
  @RequirePermission('queue_tier_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ajouter une règle de notification',
    description:
      'Configure un seuil de notification (ex: avertir le client 3 personnes avant son tour).',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiDoriCreatedResponse(
    NotificationRuleResponseDto,
    'Règle créée avec succès',
  )
  async createRule(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: CreateNotificationRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.createNotificationRule(queueId, tierId, dto, user);
  }

  @Patch('queues/:queueId/tiers/:tierId/notification-rules/:ruleId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({
    summary: 'Modifier une règle de notification',
    description: "Ajuste la valeur de seuil ou le canal d'une règle existante.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiParam({ name: 'ruleId', type: Number, description: 'ID de la règle' })
  @ApiDoriOkResponse(NotificationRuleResponseDto, 'Règle modifiée avec succès')
  async updateRule(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() dto: UpdateNotificationRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.updateNotificationRule(
      queueId,
      tierId,
      ruleId,
      dto,
      user,
    );
  }

  @Delete('queues/:queueId/tiers/:tierId/notification-rules/:ruleId')
  @RequirePermission('queue_tier_manage')
  @ApiOperation({
    summary: 'Supprimer une règle de notification',
    description: 'Supprime la règle de notification automatique.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({ name: 'tierId', type: Number, description: 'ID du forfait' })
  @ApiParam({ name: 'ruleId', type: Number, description: 'ID de la règle' })
  @ApiDoriOkResponse(DeleteTierResponseDto, 'Règle supprimée')
  async deleteRule(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('tierId', ParseIntPipe) tierId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tiersService.deleteNotificationRule(
      queueId,
      tierId,
      ruleId,
      user,
    );
  }
}
