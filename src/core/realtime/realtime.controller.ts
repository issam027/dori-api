import { RealtimeAuthorizationService } from './realtime-authorization.service';
import {
  Controller,
  Headers,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Query,
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
import { Observable, merge, map } from 'rxjs';
import { QueueDisplaySubscriptionDto } from './queue-display-subscription.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { SkipResponseEnvelope } from '../response/response.interceptor';
import {
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
  ApiDoriSseResponse,
} from '../swagger/api-dori-response.decorator';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime')
@Controller('api/v1/realtime/queues')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly authorization: RealtimeAuthorizationService,
  ) {}

  @Sse('display')
  @SkipResponseEnvelope()
  @ApiBearerAuth('bearer')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'subscribeQueuesDisplayEvents',
    summary:
      'Multiplex authorized queue display events over one SSE connection',
  })
  @ApiDoriSseResponse(
    'Multiplexed queue invalidations with queue-labelled heartbeats',
    'queue_display_changed',
    {
      queueId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'registration_called',
      timestamp: '2026-11-03T12:00:00.000Z',
    },
  )
  @ApiDoriErrorResponses({ omit409: true, omit422: true })
  async displayMany(
    @Query() query: QueueDisplaySubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Observable<MessageEvent>> {
    // Authorize the complete subscription before sending any SSE headers.
    for (const queueId of query.queueIds)
      await this.authorization.verifyDisplay(user, queueId);
    const streams = await Promise.all(
      query.queueIds.map(async (queueId) => {
        const source = await this.realtimeService.streamDisplay(
          queueId,
          undefined,
          {
            authorize: () => this.authorization.verifyDisplay(user, queueId),
            expiresAt: new Date(user.accessTokenExpiresAt! * 1000),
          },
        );
        return source.pipe(
          map((event) =>
            event.type === 'heartbeat'
              ? { ...event, data: { ...(event.data as object), queueId } }
              : event,
          ),
        );
      }),
    );
    return merge(...streams);
  }

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
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const authorize = () => this.authorization.verifyDisplay(user, queueId);
    await authorize();
    return this.realtimeService.streamDisplay(
      queueId,
      this.validLastEventId(lastEventId),
      { authorize, expiresAt: new Date(user.accessTokenExpiresAt! * 1000) },
    );
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
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const authorize = () =>
      this.authorization.verifyTracking(queueId, trackingToken);
    const expiresAt = await authorize();
    return this.realtimeService.streamTracking(
      queueId,
      this.validLastEventId(lastEventId),
      {
        authorize: async () => {
          await authorize();
        },
        expiresAt,
      },
    );
  }

  private validLastEventId(value?: string): string | undefined {
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : undefined;
  }
}
