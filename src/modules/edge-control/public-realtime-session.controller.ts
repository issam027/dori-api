import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  Injectable,
  MessageEvent,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiTags,
  PickType,
} from '@nestjs/swagger';
import { Response } from 'express';
import { EMPTY, Observable, fromEvent, takeUntil } from 'rxjs';
import { Public } from '../../core/auth/decorators/public.decorator';
import { ClockService } from '../../core/clock/clock.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { DoriException } from '../../core/errors/dori.exception';
import { RealtimeAuthorizationService } from '../../core/realtime/realtime-authorization.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ReplicatedTrackingService } from '../../core/realtime/replicated-tracking.service';
import { sessionEvents } from '../../core/realtime/session-events';
import { SkipResponseEnvelope } from '../../core/response/response.interceptor';
import {
  ApiDoriPublicErrorResponses,
  ApiDoriSseResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { RealtimeSessionDto } from './dto/realtime-session.dto';
import { RealtimeSessionRequest } from './realtime-session.guard';
import { LocalAnnouncementsService } from './local-announcements.service';
import { EdgeLocalStatusService } from './edge-local-status.service';

export class PublicRealtimeSessionDto extends PickType(RealtimeSessionDto, [
  'announcements',
  'announcementSiteId',
  'tracking',
  'trackingQueueId',
] as const) {}
@Injectable()
export class PublicRealtimeSessionGuard implements CanActivate {
  private readonly validation = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
  constructor(
    private readonly announcements: LocalAnnouncementsService,
    private readonly queues: RealtimeService,
    private readonly tracking: ReplicatedTrackingService,
    private readonly authorization: RealtimeAuthorizationService,
    private readonly status: EdgeLocalStatusService,
    private readonly events: DatabaseEventsService,
    private readonly clock: ClockService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RealtimeSessionRequest>();
    const selection: PublicRealtimeSessionDto = await this.validation.transform(
      request.body,
      { type: 'body', metatype: PublicRealtimeSessionDto },
    );
    if (
      !selection.announcements &&
      (!selection.tracking || selection.tracking === 'none')
    )
      throw new DoriException('VALIDATION_ERROR');
    const sources: Observable<MessageEvent>[] = [];
    const token = request.get('X-Registration-Token') ?? '';
    if (
      selection.tracking &&
      selection.tracking !== 'none' &&
      (await this.status.getStatus()).deploymentStatus === 'revoked'
    )
      throw new DoriException('INSTALLATION_REVOKED');
    if (selection.tracking === 'direct') {
      const queueId = selection.trackingQueueId!;
      const expiresAt = await this.authorization.verifyTracking(queueId, token);
      sources.push(
        await this.queues.streamTracking(queueId, undefined, {
          expiresAt,
          authorize: async () => {
            await this.authorization.verifyTracking(queueId, token);
          },
        }),
      );
    }
    if (selection.tracking === 'replicated')
      sources.push(await this.tracking.stream(token));
    if (selection.announcements) {
      const siteId =
        selection.tracking === 'replicated'
          ? undefined
          : selection.tracking === 'direct'
            ? await this.announcements.siteForQueue(selection.trackingQueueId!)
            : selection.announcementSiteId;
      sources.push(this.announcements.stream(siteId));
    }
    request.realtimeEvents = sessionEvents(sources, this.events, this.clock);
    return true;
  }
}
@Public()
@ApiTags('Realtime')
@Controller('api/v1/public/realtime')
export class PublicRealtimeSessionController {
  @Post('events')
  @Sse('events')
  @HttpCode(200)
  @UseGuards(PublicRealtimeSessionGuard)
  @SkipResponseEnvelope()
  @ApiProduces('text/event-stream')
  @ApiHeader({
    name: 'X-Registration-Token',
    required: false,
    description: 'Required only when following a ticket',
  })
  @ApiDoriPublicErrorResponses({
    include401: true,
    include410: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  @ApiOperation({
    operationId: 'subscribePublicRealtimeSession',
    summary:
      'Share one public SSE connection for local announcements and optional ticket tracking',
  })
  @ApiDoriSseResponse(
    'Active announcements, optional tracking and one heartbeat',
    'announcements',
    { items: [] },
  )
  stream(
    @Body() _selection: PublicRealtimeSessionDto,
    @Req() request: RealtimeSessionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Observable<MessageEvent> {
    return response.destroyed
      ? EMPTY
      : (request.realtimeEvents ?? EMPTY).pipe(
          takeUntil(fromEvent(response, 'close')),
        );
  }
}
