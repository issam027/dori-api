import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  QueueResponseDto,
  PaginatedQueueResponseDto,
  QueueStatusResponseDto,
  QueueDisplayResponseDto,
  DeleteQueueResponseDto,
  ResetQueueResponseDto,
  PaginatedQueueOperatorResponseDto,
  AssignOperatorResponseDto,
  RemoveOperatorResponseDto,
} from './dto/queue-response.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';
import { AuditEvent } from '../../core/audit/audit-event.decorator';

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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID du site',
  })
  @ApiDoriCreatedResponse(QueueResponseDto, "File d'attente créée avec succès")
  async createForSite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(QueueResponseDto, "Détails de la file d'attente")
  async findOne(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(QueueResponseDto, "File d'attente mise à jour")
  async update(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() dto: UpdateQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.updateQueue(queueId, dto, user);
  }

  @Delete('queues/:queueId')
  @AuditEvent({
    action: 'queue.delete',
    targetType: 'queue',
    targetParam: 'queueId',
  })
  @RequirePermission('queue_delete')
  @ApiOperation({
    summary: "Désactiver (supprimer) une file d'attente",
    description: "Désactive logiquement la file d'attente (soft-delete).",
  })
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(DeleteQueueResponseDto, 'File désactivée avec succès')
  async remove(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(
    QueueStatusResponseDto,
    "Statut en temps réel de la file d'attente",
  )
  async getStatus(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(
    QueueDisplayResponseDto,
    "Données pour écran d'affichage salle d'attente",
  )
  async getDisplay(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.getQueueDisplay(queueId, user);
  }

  @Post('queues/:queueId/reset')
  @AuditEvent({
    action: 'queue.reset',
    targetType: 'queue',
    targetParam: 'queueId',
  })
  @RequirePermission('queue_reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser manuellement la file',
    description:
      "Clôture ou reporte sur la date métier courante toutes les inscriptions ouvertes jusqu'à aujourd'hui, selon le mode configuré.",
  })
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(ResetQueueResponseDto, 'File réinitialisée avec succès')
  async reset(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(
    PaginatedQueueOperatorResponseDto,
    'Liste paginée des opérateurs assignés',
  )
  async getOperators(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.getOperators(queueId, pagination, user);
  }

  @Post('queues/:queueId/operators')
  @AuditEvent({
    action: 'queue.operator.assign',
    targetType: 'queue',
    targetParam: 'queueId',
    secondaryTargetBodyField: 'userId',
  })
  @RequirePermission('user_queue_assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assigner un opérateur ou une borne à la file',
    description:
      'Affecte un opérateur ou une borne à la file et garantit également son affectation au site parent.',
  })
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriCreatedResponse(
    AssignOperatorResponseDto,
    'Opérateur assigné avec succès',
  )
  async assignOperator(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Body() body: AssignOperatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.assignOperator(queueId, body.userId, user);
  }

  @Delete('queues/:queueId/operators/:userId')
  @AuditEvent({
    action: 'queue.operator.remove',
    targetType: 'queue',
    targetParam: 'queueId',
    secondaryTargetParam: 'userId',
  })
  @RequirePermission('user_queue_assign')
  @ApiOperation({
    summary: 'Retirer un opérateur ou une borne de la file',
    description:
      "Révoque l'affectation à la file. L'affectation au site parent est aussi retirée si l'utilisateur n'est affecté à aucune autre file de ce site.",
  })
  @ApiParam({
    name: '',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiParam({
    name: 'userId',
    type: String,
    description: "ID de l'utilisateur à retirer",
  })
  @ApiDoriOkResponse(RemoveOperatorResponseDto, 'Opérateur retiré avec succès')
  async removeOperator(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queuesService.removeOperator(queueId, userId, user);
  }
}
