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
  @ApiOperation({ summary: "Suivre les changements de l'écran d'attente" })
  @ApiParam({ name: 'queueId', type: String, format: 'uuid' })
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
  @ApiOperation({ summary: "Suivre les changements de position d'un ticket" })
  @ApiParam({ name: 'queueId', type: String, format: 'uuid' })
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
