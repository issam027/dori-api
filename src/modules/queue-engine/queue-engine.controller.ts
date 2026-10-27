import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  RecallRegistrationResponseDto,
  SiteCallNextResponseDto,
} from './dto/engine-response.dto';
import { CockpitQueryDto } from './dto/cockpit-query.dto';
import { CockpitResponseDto } from './dto/cockpit-response.dto';
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
  @RequirePermission('queue_view', 'registration_call')
  @ApiOperation({
    summary: 'Prévisualiser les prochains tickets éligibles',
    description:
      "Calcule l'algorithme d'équité et liste les prochains clients prioritaires sans consommer le ticket.",
  })
  @ApiParam({
    name: 'siteId',
    required: true,
    type: String,
    description: 'ID du site',
  })
  @ApiDoriOkResponse(
    [QueuePreviewItemDto],
    'Prévisualisation des prochains appels',
  )
  async nextPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() query: LimitQueryDto,
  ) {
    return this.engineService.previewNext(user, siteId, query.limit ?? 10);
  }

  @Get('sites/:siteId/cockpit')
  @RequirePermission('registration_call')
  @ApiOperation({
    summary: 'Obtenir le cockpit opérationnel du site',
    description:
      "Retourne les files autorisées, leurs sessions actives, l'appel courant de l'opérateur et les prochains candidats anonymisés.",
  })
  @ApiParam({ name: 'siteId', type: String, format: 'uuid' })
  @ApiDoriOkResponse(CockpitResponseDto, 'Snapshot opérationnel du cockpit')
  async getCockpit(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query() query: CockpitQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.getCockpit(siteId, query, user);
  }

  @Get('queues/:queueId/threads')
  @RequirePermission('session_operate')
  @ApiOperation({
    summary: "État des guichets d'une file",
    description:
      'Liste les guichets (threads) ouverts et fermés avec leur opérateur respectif.',
  })
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(PaginatedQueueThreadResponseDto, 'Liste des guichets')
  async getThreads(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(
    PaginatedQueueSessionResponseDto,
    'Liste paginée des sessions actives',
  )
  async getActiveSessions(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriCreatedResponse(QueueSessionResponseDto, 'Session de guichet ouverte')
  async openSession(
    @Param('queueId', ParseUUIDPipe) queueId: string,
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
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiParam({
    name: 'sessionId',
    type: String,
    description: 'ID de la session à fermer',
  })
  @ApiDoriOkResponse(CloseSessionResponseDto, 'Session fermée avec succès')
  async closeSession(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
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
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'ID de la file',
  })
  @ApiDoriOkResponse(
    CallNextRegistrationResponseDto,
    'Prochain ticket appelé au guichet',
  )
  async callNext(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.callNext(queueId, user);
  }

  @Post('sites/:siteId/next')
  @RequirePermission('registration_call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Appeler le meilleur candidat du site',
    description:
      "Sélectionne transactionnellement le meilleur candidat parmi les files du site où l'opérateur possède une session active sans appel en cours.",
  })
  @ApiParam({ name: 'siteId', type: String, format: 'uuid' })
  @ApiDoriOkResponse(
    SiteCallNextResponseDto,
    'Meilleur candidat appelé avec sa file',
  )
  async callNextForSite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.nextForSite(siteId, user);
  }

  @Post('queue-engine/registrations/:registrationId/recall')
  @RequirePermission('session_operate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rappeler le client en cours',
    description:
      "Rappelle le ticket actuellement pris en charge par la session active de l'opérateur, sans modifier la file ni la position des autres clients.",
  })
  @ApiParam({
    name: 'registrationId',
    type: String,
    format: 'uuid',
    description: "ID de l'inscription à rappeler",
  })
  @ApiDoriOkResponse(
    RecallRegistrationResponseDto,
    'Client rappelé au même guichet',
  )
  async recall(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.recall(registrationId, user);
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
    type: String,
    description: "ID de l'inscription cliente",
  })
  @ApiDoriOkResponse(UpdateRegistrationStatusResponseDto, 'Client marqué servi')
  async markServed(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
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
    type: String,
    description: "ID de l'inscription cliente",
  })
  @ApiDoriOkResponse(
    UpdateRegistrationStatusResponseDto,
    'Client marqué absent',
  )
  async markNoShow(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.engineService.markNoShow(registrationId, user);
  }
}
