import {
  Body,
  Controller,
  HttpCode,
  MessageEvent,
  Post,
  Res,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { EMPTY, Observable, fromEvent, takeUntil } from 'rxjs';
import { Response } from 'express';
import { SkipResponseEnvelope } from '../../core/response/response.interceptor';
import {
  ApiDoriErrorResponses,
  ApiDoriSseResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { RealtimeSessionDto } from './dto/realtime-session.dto';
import {
  RealtimeSessionGuard,
  RealtimeSessionRequest,
} from './realtime-session.guard';

@ApiTags('Realtime')
@ApiBearerAuth('bearer')
@Controller('api/v1/realtime')
export class RealtimeSessionController {
  // POST keeps large subscription sets out of URLs; Sse marks the streaming response.
  @Post('events')
  @Sse('events')
  @HttpCode(200)
  @UseGuards(RealtimeSessionGuard)
  @SkipResponseEnvelope()
  @ApiProduces('text/event-stream')
  @ApiHeader({
    name: 'X-Registration-Token',
    required: false,
    description:
      'Required only for a tracking subscription; never placed in the URL or body',
  })
  @ApiOperation({
    operationId: 'subscribeRealtimeSession',
    summary: 'One SSE connection for all subscriptions in a browser tab',
  })
  @ApiDoriErrorResponses({ omit409: true, omit422: true, include410: true })
  @ApiDoriSseResponse(
    'Queue events, local status, installation events, optional ticket tracking and one heartbeat',
    'heartbeat',
    { timestamp: '2026-11-04T10:00:00.000Z' },
  )
  stream(
    @Body() _query: RealtimeSessionDto,
    @Req() request: RealtimeSessionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Observable<MessageEvent> {
    const events = request.realtimeEvents ?? EMPTY;
    // POST request-body completion is not the stream's lifetime. Always clean up
    // from the response socket too, including browser aborts during navigation.
    return response.destroyed
      ? EMPTY
      : events.pipe(takeUntil(fromEvent(response, 'close')));
  }
}
