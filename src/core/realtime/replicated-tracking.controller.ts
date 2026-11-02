import {
  Controller,
  Header,
  Headers,
  MessageEvent,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import { SkipResponseEnvelope } from '../response/response.interceptor';
import { ReplicatedTrackingService } from './replicated-tracking.service';
import { ReplicatedTrackingGuard } from './replicated-tracking.guard';
import {
  ApiDoriPublicErrorResponses,
  ApiDoriSseResponse,
} from '../swagger/api-dori-response.decorator';

@ApiTags('Realtime')
@Controller('api/v1/realtime/tracking')
export class ReplicatedTrackingController {
  constructor(private readonly tracking: ReplicatedTrackingService) {}

  @Public()
  @Sse()
  @UseGuards(ReplicatedTrackingGuard)
  @Header('Cache-Control', 'no-store, no-transform')
  @Header('X-Accel-Buffering', 'no')
  @SkipResponseEnvelope()
  @ApiProduces('text/event-stream')
  @ApiHeader({ name: 'X-Registration-Token', required: true })
  @ApiDoriSseResponse(
    'Instantanés publics du ticket intra',
    'tracking_changed',
    {
      status: 'waiting',
      registrationStatus: 'waiting',
      position: 3,
      estimatedWaitMinutes: 6,
      sourceConnectivity: 'online',
    },
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    include410: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  @ApiOperation({
    operationId: 'subscribeReplicatedTrackingEvents',
    summary: 'Suivre un ticket intra répliqué dans le cloud',
    description:
      'Flux tracking_changed avec instantané public initial et mises à jour. Le jeton reste dans un en-tête ; aucun identifiant de file cloud n’est nécessaire.',
  })
  stream(
    @Headers('X-Registration-Token') token: string,
  ): Promise<Observable<MessageEvent>> {
    return this.tracking.stream(token);
  }
}
