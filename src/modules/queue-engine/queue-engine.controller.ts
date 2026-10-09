import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { QueueEngineService } from './queue-engine.service';
import { OpenQueueSessionDto } from './dto/session.dto';
import {
  QueuePreviewItemDto,
  PaginatedQueueThreadResponseDto,
  QueueSessionResponseDto,
  PaginatedQueueSessionResponseDto,
  CallNextRegistrationResponseDto,
  CloseSessionResponseDto,
  UpdateRegistrationStatusResponseDto,
} from './dto/engine-response.dto';
import {
  LimitQueryDto,
  PaginationDto,
} from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('QueueEngine')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1')
export class QueueEngineController {
  constructor(private readonly engineService: QueueEngineService) {}

  @Get('sites/:siteId/next-preview')
  @RequirePermission('queue_view')
  @ApiOperation({
    summary: 'Prévisualiser les prochains tickets éligibles',
    description:
      "Calcule l'algorithme d'équité et liste les prochains clients prioritaires sans consommer le ticket.",
  })
  @ApiParam({
    name: 'siteId',
    required: true,
    type: Number,
    description: 'ID du site',
  })
  @ApiDoriOkResponse(
    [QueuePreviewItemDto],
    'Prévisualisation des prochains appels',
  )
  async nextPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId', ParseIntPipe) siteId: number,
    @Query() query: LimitQueryDto,
  ) {
    return this.engineService.previewNext(user, siteId, query.limit ?? 10);
  }

  @Get('queues/:queueId/threads')
  @RequirePermission('session_operate')
  @ApiOperation({
    summary: "État des guichets d'une file",
    description:
      'Liste les guichets (threads) ouverts et fermés avec leur opérateur respectif.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(PaginatedQueueThreadResponseDto, 'Liste des guichets')
  async getThreads(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.getThreadsStatus(queueId, user, pagination);
  }

  @Get('queues/:queueId/sessions')
  @RequirePermission('session_operate')
  @ApiOperation({
    summary: "Sessions actives d'une file",
    description:
      'Retourne la liste paginée des sessions de guichets actuellement en cours.',
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    PaginatedQueueSessionResponseDto,
    'Liste paginée des sessions actives',
  )
  async getActiveSessions(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.getActiveSessions(queueId, pagination, user);
  }

  @Post('queues/:queueId/sessions')
  @RequirePermission('session_operate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ouvrir une session de guichet',
    description:
      "Ouvre un guichet pour l'opérateur connecté et l'active pour recevoir les appels de clients.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriCreatedResponse(QueueSessionResponseDto, 'Session de guichet ouverte')
  async openSession(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: OpenQueueSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.openSession(queueId, dto, user);
  }

  @Delete('queues/:queueId/sessions/:sessionId')
  @RequirePermission('session_operate')
  @ApiOperation({
    summary: 'Fermer une session de guichet',
    description:
      "Déconnecte l'opérateur du guichet et clôture la session active.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiParam({
    name: 'sessionId',
    type: Number,
    description: 'ID de la session à fermer',
  })
  @ApiDoriOkResponse(CloseSessionResponseDto, 'Session fermée avec succès')
  async closeSession(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.closeSession(queueId, sessionId, user);
  }

  @Post('queues/:queueId/next')
  @RequirePermission('registration_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Appeler le prochain ticket',
    description:
      "Sélectionne le prochain client selon l'algorithme d'escalade et lui assigne le guichet de l'opérateur.",
  })
  @ApiParam({ name: 'queueId', type: Number, description: 'ID de la file' })
  @ApiDoriOkResponse(
    CallNextRegistrationResponseDto,
    'Prochain ticket appelé au guichet',
  )
  async callNext(
    @Param('queueId', ParseIntPipe) queueId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.callNext(queueId, user);
  }

  @Post('registrations/:registrationId/served')
  @RequirePermission('registration_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marquer un client comme servi',
    description:
      'Termine le traitement du ticket en cours et libère le guichet.',
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription cliente",
  })
  @ApiDoriOkResponse(UpdateRegistrationStatusResponseDto, 'Client marqué servi')
  async markServed(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.markServed(registrationId, user);
  }

  @Post('registrations/:registrationId/no-show')
  @RequirePermission('registration_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déclarer un client absent (No-show)',
    description:
      "Marque le ticket comme absent lorsque le client ne s'est pas présenté au guichet après appel.",
  })
  @ApiParam({
    name: 'registrationId',
    type: Number,
    description: "ID de l'inscription cliente",
  })
  @ApiDoriOkResponse(
    UpdateRegistrationStatusResponseDto,
    'Client marqué absent',
  )
  async markNoShow(
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.markNoShow(registrationId, user);
  }
}
