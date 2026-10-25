import {
  Controller,
  Headers,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ClockService } from '../clock/clock.service';
import { DoriException } from '../errors/dori.exception';
import { ScopeService } from '../rbac/services/scope.service';
import { SkipResponseEnvelope } from '../response/response.interceptor';
import {
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
  ApiDoriSseResponse,
} from '../swagger/api-dori-response.decorator';
import { RealtimeRepository } from './realtime.repository';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime')
@Controller('api/v1/realtime/queues')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly realtimeRepository: RealtimeRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  @Sse(':queueId/display')
  @SkipResponseEnvelope()
  @ApiBearerAuth('bearer')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'subscribeQueueDisplayEvents',
    summary: "Suivre les changements de l'écran d'attente",
    description:
      "Ouvre un flux SSE authentifié. À chaque événement `queue_display_changed`, l'IHM doit recharger le snapshot REST de l'écran. Le flux ne transporte aucune donnée métier détaillée.",
  })
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: 'Identifiant UUID de la file suivie',
  })
  @ApiDoriSseResponse(
    "Flux des invalidations de l'écran d'attente",
    'queue_display_changed',
    {
      queueId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'registration_called',
      timestamp: '2026-10-25T14:00:00.000Z',
    },
  )
  @ApiDoriErrorResponses({ omit403: true, omit409: true, omit422: true })
  async display(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Observable<MessageEvent>> {
    await this.scopeService.checkQueueAccess(user, queueId);
    return this.realtimeService.streamDisplay(queueId);
  }

  @Public()
  @Sse(':queueId/tracking')
  @SkipResponseEnvelope()
  @ApiSecurity('registration-token')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'subscribeQueueTrackingEvents',
    summary: "Suivre les changements de position d'un ticket",
    description:
      "Ouvre un flux SSE public protégé par le token de suivi. À chaque événement `queue_position_changed`, l'IHM doit rappeler `GET /api/v1/public/registrations/position`.",
  })
  @ApiParam({
    name: 'queueId',
    type: String,
    format: 'uuid',
    description: "Identifiant UUID de la file associée à l'inscription",
  })
  @ApiHeader({
    name: 'X-Registration-Token',
    required: true,
    schema: { type: 'string', format: 'uuid' },
    description: "Token opaque de suivi retourné lors de l'inscription",
  })
  @ApiDoriSseResponse(
    'Flux des invalidations de position du ticket',
    'queue_position_changed',
    {
      queueId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-10-25T14:00:00.000Z',
    },
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    include410: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  async tracking(
    @Param('queueId', ParseUUIDPipe) queueId: string,
    @Headers('X-Registration-Token') trackingToken: string,
  ): Promise<Observable<MessageEvent>> {
    if (!trackingToken) throw new DoriException('UNAUTHENTICATED');
    const registration =
      await this.realtimeRepository.findRegistrationByTrackingToken(
        trackingToken,
      );
    if (
      !registration ||
      !registration.is_active ||
      registration.queue_id !== queueId ||
      this.clockService.parse(
        registration.registration_tracking_token_valid_until,
      ) <= this.clockService.now()
    ) {
      throw new DoriException('TOKEN_EXPIRED');
    }
    return this.realtimeService.streamTracking(queueId);
  }
}
