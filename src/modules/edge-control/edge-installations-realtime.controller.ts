import { Controller, Headers, MessageEvent, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { JwtSessionRepository } from '../../core/auth/repositories/jwt-session.repository';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';
import { SkipResponseEnvelope } from '../../core/response/response.interceptor';
import { ApiDoriSseResponse } from '../../core/swagger/api-dori-response.decorator';
import { EdgeInstallationsRealtimeService } from './edge-installations-realtime.service';

@ApiTags('Edge administration')
@ApiBearerAuth('bearer')
@RequirePermission('edge_installation_manage')
@Controller('api/v1/edge/installations')
export class EdgeInstallationsRealtimeController {
  constructor(
    private readonly realtime: EdgeInstallationsRealtimeService,
    private readonly sessions: JwtSessionRepository,
    private readonly clock: ClockService,
  ) {}

  @Sse('realtime/events')
  @SkipResponseEnvelope()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'subscribeEdgeInstallationEvents',
    summary: 'Subscribe to installation inventory and status changes',
  })
  @ApiDoriSseResponse(
    'Installation room invalidations',
    'edge_installations_changed',
    {
      room: 'edge-installations',
      timestamp: '2026-10-31T10:00:00.000Z',
    },
  )
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('last-event-id') _lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const authorize = async () => {
      if (
        !user.sessionId ||
        !user.accessTokenExpiresAt ||
        user.accessTokenExpiresAt * 1000 <= this.clock.now().getTime()
      ) {
        throw new DoriException('UNAUTHENTICATED');
      }
      const session = await this.sessions.findValidSessionId(
        user.sessionId,
        user.userId,
        this.clock.now(),
      );
      if (!session) throw new DoriException('UNAUTHENTICATED');
    };
    await authorize();
    return this.realtime.stream({
      authorize,
      expiresAt: new Date(user.accessTokenExpiresAt! * 1000),
    });
  }
}
