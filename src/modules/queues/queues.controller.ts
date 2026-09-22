import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { CreateQueueDto, UpdateQueueDto, AssignOperatorDto } from './dto/queue.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  QueueResponseDto,
  QueueStatusResponseDto,
  QueueThreadsResponseDto,
  QueueOperatorDto,
  QueueOperatorAssignmentResponseDto,
} from './dto/queue-response.dto';
import { ActionSuccessResponseDto } from '../auth/dto/auth-response.dto';

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post('sites/:siteId/queues')
  @RequirePermission('queue_create')
  @ApiOperation({ summary: "Créer une file d'attente dans un site" })
  @ApiStandardResponse({
    type: QueueResponseDto,
    status: HttpStatus.CREATED,
    description: "File créée avec association automatique au forfait 'free'",
  })
  async create(
    @Param('siteId', ParseIntPipe) siteId: number,
    @Body() dto: CreateQueueDto,
  ) {
    return this.queuesService.create(siteId, dto);
  }

  @Get('sites/:siteId/queues')
  @RequirePermission('queue_view')
  @ApiOperation({ summary: "Liste des files d'un site selon le périmètre" })
  @ApiStandardResponse({
    type: QueueResponseDto,
    isArray: true,
    description: 'Liste des files du site avec configuration effective résolue',
  })
  async findBySite(
    @CurrentUser() user: UserContext,
    @Param('siteId', ParseIntPipe) siteId: number,
  ) {
    return this.queuesService.findBySite(user, siteId);
  }

  @Get('queues/:queueId')
  @RequirePermission('queue_view')
  @ApiOperation({ summary: "Détails et configuration effective d'une file (avec origine de l'héritage §4.5)" })
  @ApiStandardResponse({
    type: QueueResponseDto,
    description: "Configuration complète de la file avec indication de source ('inherited' | 'overridden')",
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queuesService.findById(user, queueId);
  }

  @Patch('queues/:queueId')
  @RequirePermission('queue_edit')
  @ApiOperation({ summary: "Mettre à jour une file d'attente" })
  @ApiStandardResponse({
    type: QueueResponseDto,
    description: 'File mise à jour avec recalcul de la configuration effective',
  })
  async update(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: UpdateQueueDto,
  ) {
    return this.queuesService.update(user, queueId, dto);
  }

  @Delete('queues/:queueId')
  @RequirePermission('queue_delete')
  @ApiOperation({ summary: "Désactiver une file d'attente (soft delete)" })
  @ApiStandardResponse({
    type: QueueResponseDto,
    description: 'File désactivée (soft delete)',
  })
  async delete(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queuesService.delete(user, queueId);
  }

  @Get('queues/:queueId/status')
  @RequirePermission('queue_view')
  @ApiOperation({ summary: "Statut temps réel de la file (attente, guichets, prochains RDV)" })
  @ApiStandardResponse({
    type: QueueStatusResponseDto,
    description: "Statut temps réel de la file d'attente pour le jour ouvrable courant",
  })
  async getStatus(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queuesService.getStatus(user, queueId);
  }

  @Get('queues/:queueId/threads')
  @RequirePermission('queue_view')
  @ApiOperation({ summary: 'État des guichets (threads) conformément au contrat §6.1' })
  @ApiStandardResponse({
    type: QueueThreadsResponseDto,
    description: 'État dynamique des guichets physiques et des sessions d’opérateurs',
  })
  async getThreads(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queuesService.getThreads(user, queueId);
  }

  @Get('queues/:queueId/operators')
  @RequirePermission('user_queue_assign')
  @ApiOperation({ summary: "Liste des opérateurs et bornes affectés à la file" })
  @ApiStandardResponse({
    type: QueueOperatorDto,
    isArray: true,
    description: 'Liste des utilisateurs habilités à opérer sur la file',
  })
  async getOperators(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
  ) {
    return this.queuesService.getOperators(user, queueId);
  }

  @Post('queues/:queueId/operators')
  @RequirePermission('user_queue_assign')
  @ApiOperation({ summary: "Affecter un opérateur ou une borne à la file" })
  @ApiStandardResponse({
    type: QueueOperatorAssignmentResponseDto,
    description: 'Opérateur affecté à la file',
  })
  async assignOperator(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: AssignOperatorDto,
  ) {
    return this.queuesService.assignOperator(user, queueId, dto.userId);
  }

  @Delete('queues/:queueId/operators/:userId')
  @RequirePermission('user_queue_assign')
  @ApiOperation({ summary: "Retirer l'affectation d'un opérateur sur la file" })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Affectation supprimée',
  })
  async unassignOperator(
    @CurrentUser() user: UserContext,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.queuesService.unassignOperator(user, queueId, userId);
  }
}
