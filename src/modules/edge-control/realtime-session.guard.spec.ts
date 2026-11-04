import { ExecutionContext, MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Response } from 'express';
import { Subject } from 'rxjs';
import { RealtimeSessionController } from './realtime-session.controller';
import {
  RealtimeSessionGuard,
  RealtimeSessionRequest,
} from './realtime-session.guard';
import { RealtimeSessionService } from './realtime-session.service';
import { RealtimeSessionDto } from './dto/realtime-session.dto';

describe('SSE session preflight and response lifetime', () => {
  const context = (request: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('rejects an invalid selection before creating a stream', async () => {
    const service = { stream: jest.fn() };
    const guard = new RealtimeSessionGuard(
      service as unknown as RealtimeSessionService,
    );
    await expect(
      guard.canActivate(context({ user: {}, body: { localStatus: 'false' } })),
    ).rejects.toMatchObject({ status: 400 });
    expect(service.stream).not.toHaveBeenCalled();
  });

  it('does not allow tokens hidden in the subscription body', async () => {
    const service = { stream: jest.fn() };
    const guard = new RealtimeSessionGuard(
      service as unknown as RealtimeSessionService,
    );
    await expect(
      guard.canActivate(
        context({ user: {}, body: { localStatus: true, token: 'opaque' } }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(service.stream).not.toHaveBeenCalled();
  });

  it('propagates denied room authorization before any SSE headers', async () => {
    const denied = new Error('forbidden');
    const service = { stream: jest.fn().mockRejectedValue(denied) };
    const guard = new RealtimeSessionGuard(
      service as unknown as RealtimeSessionService,
    );
    const request = {
      user: {},
      body: { localStatus: true },
      get: () => undefined,
      realtimeEvents: undefined,
    };
    await expect(guard.canActivate(context(request))).rejects.toBe(denied);
    expect(request.realtimeEvents).toBeUndefined();
  });

  it('unsubscribes all topics when the POST response socket closes', () => {
    const events = new Subject<MessageEvent>();
    const response = Object.assign(new EventEmitter(), { destroyed: false });
    const controller = new RealtimeSessionController();
    const observable = controller.stream(
      new RealtimeSessionDto(),
      { realtimeEvents: events } as unknown as RealtimeSessionRequest,
      response as unknown as Response,
    );
    const subscription = observable.subscribe();
    expect(events.observed).toBe(true);
    response.emit('close');
    expect(subscription.closed).toBe(true);
    expect(events.observed).toBe(false);
  });
});
