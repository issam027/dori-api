import { ExecutionContext, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PublicRealtimeSessionGuard } from './public-realtime-session.controller';
import { LocalAnnouncementsService } from './local-announcements.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ReplicatedTrackingService } from '../../core/realtime/replicated-tracking.service';
import { RealtimeAuthorizationService } from '../../core/realtime/realtime-authorization.service';
import { EdgeLocalStatusService } from './edge-local-status.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { ClockService } from '../../core/clock/clock.service';

const queueId = '550e8400-e29b-41d4-a716-446655440000';
const forgedSiteId = '550e8400-e29b-41d4-a716-446655440001';
function setup(body: unknown) {
  const source = new Subject<MessageEvent>();
  const announcements = {
    stream: jest.fn(() => source),
    siteForQueue: jest.fn(async () => 'actual-site'),
  };
  const authorization = {
    verifyTracking: jest.fn(async () => new Date(Date.now() + 60000)),
  };
  const queues = { streamTracking: jest.fn(async () => source) };
  const tracking = { stream: jest.fn(async () => source) };
  const request = { body, get: () => 'private-ticket-token' };
  const guard = new PublicRealtimeSessionGuard(
    announcements as unknown as LocalAnnouncementsService,
    queues as unknown as RealtimeService,
    tracking as unknown as ReplicatedTrackingService,
    authorization as unknown as RealtimeAuthorizationService,
    {
      getStatus: async () => ({ deploymentStatus: 'active' }),
    } as EdgeLocalStatusService,
    { connected: true } as DatabaseEventsService,
    { now: () => new Date() } as ClockService,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { guard, context, announcements, authorization, tracking };
}
it.each([
  'localStatus',
  'installations',
  'announcementAdministration',
  'queueIds',
])(
  'rejects private %s topics before opening public SSE headers',
  async (key) => {
    const h = setup({
      announcements: true,
      [key]: key === 'queueIds' ? [] : true,
    });
    await expect(h.guard.canActivate(h.context)).rejects.toMatchObject({
      status: 400,
    });
    expect(h.announcements.stream).not.toHaveBeenCalled();
  },
);
it('derives direct tracking announcements from the authorized queue, ignoring a forged site', async () => {
  const h = setup({
    announcements: true,
    tracking: 'direct',
    trackingQueueId: queueId,
    announcementSiteId: forgedSiteId,
  });
  await expect(h.guard.canActivate(h.context)).resolves.toBe(true);
  expect(h.authorization.verifyTracking).toHaveBeenCalledWith(
    queueId,
    'private-ticket-token',
  );
  expect(h.announcements.siteForQueue).toHaveBeenCalledWith(queueId);
  expect(h.announcements.stream).toHaveBeenCalledWith('actual-site');
});
it('does not expose intra site announcements on cloud replicated tracking', async () => {
  const h = setup({
    announcements: true,
    tracking: 'replicated',
    announcementSiteId: forgedSiteId,
  });
  await h.guard.canActivate(h.context);
  expect(h.tracking.stream).toHaveBeenCalledWith('private-ticket-token');
  expect(h.announcements.stream).toHaveBeenCalledWith(undefined);
  expect(h.announcements.siteForQueue).not.toHaveBeenCalled();
});
it('allows public site announcements without authorizing a ticket', async () => {
  const h = setup({ announcements: true, announcementSiteId: forgedSiteId });
  await h.guard.canActivate(h.context);
  expect(h.authorization.verifyTracking).not.toHaveBeenCalled();
  expect(h.announcements.stream).toHaveBeenCalledWith(forgedSiteId);
});
