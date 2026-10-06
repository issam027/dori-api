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
import { QueuesService } from './queues.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import {
  UpdateQueueDto,
  QueueFilterDto,
  AssignOperatorDto,
} from './dto/update-queue.dto';
import {
  QueueDetailResponseDto,
  PaginatedQueueResponseDto,
  QueueStatusResponseDto,
  QueueDisplayResponseDto,
  QueueDeleteResponseDto,
  QueueResetResponseDto,
  PaginatedQueueOperatorResponseDto,
  AssignOperatorResponseDto,
  RemoveOperatorResponseDto,
} from './dto/queue-response.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Queues')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get('queues')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: "Lister les files d'attente",
    description:
      "Retourne la liste paginée des files d'attente accessibles selon le périmètre de l'utilisateur.",
  })
  @ApiDoriOkResponse(
    PaginatedQueueResponseDto,
    "Liste paginée des files d'attente",
  )
  async findAll(
    @Query() filter: QueueFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.findQueues(filter, user);
  }

  @Post('sites/:siteId/queues')
  @RequirePermission('queue_create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer une file d'attente pour un site",
    description:
      "Crée une nouvelle file d'attente rattachée au site spécifié en héritant ou surchargeant les configurations par défaut.",
  })
  @ApiParam({ name: 'siteId', type: Number, description: 'ID du site' })
  @ApiDoriCreatedResponse(
    QueueDetailResponseDto,
    "File d'attente créée avec succès",
  )
  async createForSite(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() dto: CreateQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.createQueue(siteId, dto, user);
  }

  @Get('queues/:queueId')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: "Détails d'une file d'attente",
    description:
      "Retourne les paramètres complets d'une file d'attente par son ID.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(QueueDetailResponseDto, "Détails de la file d'attente")
  async findOne(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.findQueueById(queueId, user);
  }

  @Patch('queues/:queueId')
  @RequirePermission('queue_edit')
  @ApiOperation({
    summary: "Modifier une file d'attente",
    description:
      "Met à jour les configurations horaires, de tolérance ou de priorités d'une file.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(QueueDetailResponseDto, "File d'attente mise à jour")
  async update(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: UpdateQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.updateQueue(queueId, dto, user);
  }

  @Delete('queues/:queueId')
  @RequirePermission('queue_delete')
  @ApiOperation({
    summary: "Désactiver (supprimer) une file d'attente",
    description: "Désactive logiquement la file d'attente (soft-delete).",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(QueueDeleteResponseDto, 'File désactivée avec succès')
  async remove(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.deleteQueue(queueId, user);
  }

  @Get('queues/:queueId/status')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: 'État en temps réel de la file',
    description:
      "Fournit le nombre de personnes en attente, le temps d'attente estimé, les guichets actifs et les prochains RDV.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    QueueStatusResponseDto,
    "Statut en temps réel de la file d'attente",
  )
  async getStatus(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.getQueueStatus(queueId, user);
  }

  @Get('queues/:queueId/display')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: "Flux d'affichage pour écran (Display)",
    description:
      "Retourne les tickets en cours d'appel et le journal récent des appels pour les écrans de salle d'attente.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    QueueDisplayResponseDto,
    "Données pour écran d'affichage salle d'attente",
  )
  async getDisplay(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.getQueueDisplay(queueId, user);
  }

  @Post('queues/:queueId/reset')
  @RequirePermission('queue_edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser manuellement la file',
    description:
      'Clôture les inscriptions en attente du jour selon le mode configuré.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(QueueResetResponseDto, 'File réinitialisée avec succès')
  async reset(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.resetQueue(queueId, user);
  }

  @Get('queues/:queueId/operators')
  @RequirePermission('user_queue_assign')
  @ApiOperation({
    summary: 'Lister les opérateurs assignés',
    description:
      'Retourne la liste des utilisateurs autorisés à opérer sur cette file.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    PaginatedQueueOperatorResponseDto,
    'Liste paginée des opérateurs assignés',
  )
  async getOperators(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.getOperators(queueId, pagination, user);
  }

  @Post('queues/:queueId/operators')
  @RequirePermission('user_queue_assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assigner un opérateur à la file',
    description:
      "Donne l'autorisation à un utilisateur d'opérer les guichets de cette file.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriCreatedResponse(
    AssignOperatorResponseDto,
    'Opérateur assigné avec succès',
  )
  async assignOperator(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() body: AssignOperatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.assignOperator(queueId, body.userId, user);
  }

  @Delete('queues/:queueId/operators/:userId')
  @RequirePermission('user_queue_assign')
  @ApiOperation({
    summary: 'Retirer un opérateur de la file',
    description:
      "Révoque l'affectation d'un opérateur sur cette file d'attente.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: "ID de l'utilisateur à retirer",
  })
  @ApiDoriOkResponse(RemoveOperatorResponseDto, 'Opérateur retiré avec succès')
  async removeOperator(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.removeOperator(queueId, userId, user);
  }
}
