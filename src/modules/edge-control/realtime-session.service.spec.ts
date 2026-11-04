import { LocalAnnouncementsService } from './local-announcements.service';
import { MessageEvent, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, SSE_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Subject, filter } from 'rxjs';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import {
  DatabaseChange,
  DatabaseEventsService,
} from '../../core/database/database-events.service';
import { RealtimeAuthorizationService } from '../../core/realtime/realtime-authorization.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ReplicatedTrackingService } from '../../core/realtime/replicated-tracking.service';
import { EdgeLocalStatusService } from './edge-local-status.service';
import { EdgeLocalRealtimeService } from './edge-local-realtime.service';
import { EdgeInstallationsRealtimeService } from './edge-installations-realtime.service';
import { RealtimeSessionDto } from './dto/realtime-session.dto';
import { RealtimeSessionController } from './realtime-session.controller';
import { RealtimeSessionService } from './realtime-session.service';

const queueId = '550e8400-e29b-41d4-a716-446655440000';
function setup() {
  const changes = new Subject<DatabaseChange>();
  const queue = new Subject<MessageEvent>(),
    local = new Subject<MessageEvent>(),
    installation = new Subject<MessageEvent>(),
    ticket = new Subject<MessageEvent>();
  const authorization = {
    verifySession: jest.fn(async () => undefined),
    verifyDisplay: jest.fn(async () => undefined),
    verifyTracking: jest.fn(async () => new Date(Date.now() + 60000)),
  };
  const queues = {
    streamDisplay: jest.fn(async () => queue),
    streamTracking: jest.fn(async () => ticket),
  };
  const localService = { stream: jest.fn(() => local) };
  const installations = { stream: jest.fn(async () => installation) };
  const tracking = {
    authorize: jest.fn(async () => undefined),
    stream: jest.fn(async () => ticket),
  };
  const status = {
    getStatus: jest.fn(async () => ({ deploymentStatus: 'active' })),
  };
  const events = {
    connected: true,
    changes: (keys: string[]) =>
      changes.pipe(filter((change) => keys.includes(change.key))),
  };
  const service = new RealtimeSessionService(
    authorization as unknown as RealtimeAuthorizationService,
    queues as unknown as RealtimeService,
    localService as unknown as EdgeLocalRealtimeService,
    installations as unknown as EdgeInstallationsRealtimeService,
    tracking as unknown as ReplicatedTrackingService,
    status as unknown as EdgeLocalStatusService,
    events as DatabaseEventsService,
    { now: () => new Date() } as ClockService,
    { stream: () => local } as unknown as LocalAnnouncementsService,
  );
  const user = {
    roles: ['root'],
    permissions: [],
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  } as unknown as AuthenticatedUser;
  return {
    service,
    authorization,
    queues,
    localService,
    installations,
    tracking,
    status,
    user,
    queue,
    local,
    ticket,
    changes,
  };
}
const dto = (data: Partial<RealtimeSessionDto>) =>
  Object.assign(new RealtimeSessionDto(), data);
describe('one SSE session per tab', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps POST routing and SSE response metadata together', () => {
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        RealtimeSessionController.prototype.stream,
      ),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata(
        SSE_METADATA,
        RealtimeSessionController.prototype.stream,
      ),
    ).toBe(true);
  });

  it('checks every queue before exposing any authorized room', async () => {
    const h = setup();
    h.authorization.verifyDisplay.mockRejectedValue(
      new Error('forbidden') as never,
    );
    await expect(
      h.service.stream(
        dto({ queueIds: [queueId], localStatus: true }),
        h.user,
        '',
      ),
    ).rejects.toThrow('forbidden');
    expect(h.localService.stream).not.toHaveBeenCalled();
    expect(h.queues.streamDisplay).not.toHaveBeenCalled();
  });

  it('rejects installation subscriptions without their management permission', async () => {
    const h = setup();
    h.user.roles = ['operator'];
    await expect(
      h.service.stream(
        dto({ localStatus: true, installations: true }),
        h.user,
        '',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
    expect(h.localService.stream).not.toHaveBeenCalled();
  });

  it('keeps local status accessible while a revoked installation cannot subscribe to queues', async () => {
    const h = setup();
    h.status.getStatus.mockResolvedValue({ deploymentStatus: 'revoked' });
    await expect(
      h.service.stream(
        dto({ localStatus: true, queueIds: [queueId] }),
        h.user,
        '',
      ),
    ).rejects.toMatchObject({ code: 'INSTALLATION_REVOKED' });
    const stream = await h.service.stream(
      dto({ localStatus: true }),
      h.user,
      '',
    );
    const subscription = stream.subscribe();
    expect(h.localService.stream).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('merges room events and sends only one heartbeat', async () => {
    const h = setup();
    const received = jest.fn();
    const stream = await h.service.stream(
      dto({ localStatus: true, queueIds: [queueId], installations: true }),
      h.user,
      '',
    );
    const subscription = stream.subscribe(received);
    h.local.next({
      type: 'edge_local_status',
      data: { deploymentStatus: 'active' },
    });
    h.queue.next({ type: 'queue_display_changed', data: { queueId } });
    h.queue.next({ type: 'heartbeat', data: {} });
    await jest.advanceTimersByTimeAsync(15000);
    expect(received.mock.calls.map(([event]) => event.type)).toEqual([
      'edge_local_status',
      'queue_display_changed',
      'heartbeat',
    ]);
    subscription.unsubscribe();
    expect(h.local.observed).toBe(false);
    expect(h.queue.observed).toBe(false);
  });

  it('closes every room if a topic ends rather than advertising a false healthy heartbeat', async () => {
    const h = setup();
    const stream = await h.service.stream(
      dto({ localStatus: true, queueIds: [queueId] }),
      h.user,
      '',
    );
    const subscription = stream.subscribe();
    h.queue.complete();
    expect(subscription.closed).toBe(true);
    expect(h.local.observed).toBe(false);
  });

  it('authorizes a replicated tracking token before opening the other rooms', async () => {
    const h = setup();
    h.tracking.authorize.mockRejectedValue(new Error('expired') as never);
    await expect(
      h.service.stream(
        dto({ localStatus: true, tracking: 'replicated' }),
        h.user,
        'opaque',
      ),
    ).rejects.toThrow('expired');
    expect(h.localService.stream).not.toHaveBeenCalled();
  });

  it('bounds the whole connection by the authenticated session even for replicated tracking', async () => {
    const h = setup();
    h.user.accessTokenExpiresAt = Math.floor(Date.now() / 1000) + 1;
    const stream = await h.service.stream(
      dto({ tracking: 'replicated' }),
      h.user,
      'opaque',
    );
    const subscription = stream.subscribe();
    await jest.advanceTimersByTimeAsync(1000);
    expect(subscription.closed).toBe(true);
    expect(h.ticket.observed).toBe(false);
  });

  it.each([
    { queueIds: [queueId, queueId] },
    { queueIds: ['not-an-id'] },
    { localStatus: 'false' },
    { tracking: 'direct' },
    { queueIds: Array.from({ length: 1001 }, () => queueId) },
  ])('rejects malformed or oversized subscription sets: %j', async (data) => {
    expect(
      await validate(plainToInstance(RealtimeSessionDto, data)),
    ).not.toHaveLength(0);
  });
});
