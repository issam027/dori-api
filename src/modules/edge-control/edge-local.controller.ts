import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RealtimeAuthorizationService } from '../../core/realtime/realtime-authorization.service';
import { SkipResponseEnvelope } from '../../core/response/response.interceptor';
import { ApiDoriSseResponse } from '../../core/swagger/api-dori-response.decorator';
import { EdgeLocalRealtimeService } from './edge-local-realtime.service';
import {
  ApiDoriErrorResponses,
  ApiDoriOkResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { EdgeLocalStatusResponseDto } from './dto/edge-control.dto';
import { EdgeLocalStatusService } from './edge-local-status.service';

@ApiTags('Edge local status')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses({ omit403: true, omit404: true })
@Controller('api/v1/edge/local-status')
export class EdgeLocalController {
  constructor(
    private readonly service: EdgeLocalStatusService,
    private readonly realtime: EdgeLocalRealtimeService,
    private readonly authorization: RealtimeAuthorizationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Read the non-blocking cloud status reported by the local agent',
  })
  @ApiDoriOkResponse(EdgeLocalStatusResponseDto)
  status() {
    return this.service.getStatus();
  }

  @Sse('events')
  @SkipResponseEnvelope()
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'subscribeEdgeLocalStatus',
    summary: 'Receive local agent status snapshots and heartbeats',
  })
  @ApiDoriSseResponse(
    'Initial local status and subsequent persisted changes',
    'edge_local_status',
    {
      configured: true,
      deploymentStatus: 'active',
      cloudReachability: 'connected',
      lastCloudSuccessAt: '2026-11-04T10:00:00.000Z',
      lastCloudError: null,
    },
  )
  async events(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Observable<MessageEvent>> {
    const authorize = () => this.authorization.verifySession(user);
    await authorize();
    return this.realtime.stream({
      authorize,
      expiresAt: new Date((user.accessTokenExpiresAt ?? 0) * 1000),
    });
  }
}
