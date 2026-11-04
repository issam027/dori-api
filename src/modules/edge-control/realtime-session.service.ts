import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { sessionEvents } from '../../core/realtime/session-events';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { DoriException } from '../../core/errors/dori.exception';
import { RealtimeAuthorizationService } from '../../core/realtime/realtime-authorization.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ReplicatedTrackingService } from '../../core/realtime/replicated-tracking.service';
import { EdgeLocalStatusService } from './edge-local-status.service';
import { EdgeLocalRealtimeService } from './edge-local-realtime.service';
import { EdgeInstallationsRealtimeService } from './edge-installations-realtime.service';
import { RealtimeSessionDto } from './dto/realtime-session.dto';
import { LocalAnnouncementsService } from './local-announcements.service';

@Injectable()
export class RealtimeSessionService {
  constructor(
    private readonly authorization: RealtimeAuthorizationService,
    private readonly queues: RealtimeService,
    private readonly local: EdgeLocalRealtimeService,
    private readonly installations: EdgeInstallationsRealtimeService,
    private readonly tracking: ReplicatedTrackingService,
    private readonly status: EdgeLocalStatusService,
    private readonly events: DatabaseEventsService,
    private readonly clock: ClockService,
    private readonly announcements: LocalAnnouncementsService,
  ) {}

  async stream(
    query: RealtimeSessionDto,
    user: AuthenticatedUser,
    trackingToken: string,
  ): Promise<Observable<MessageEvent>> {
    const queueIds = query.queueIds ?? [];
    if (
      !queueIds.length &&
      !query.localStatus &&
      !query.announcements &&
      !query.announcementAdministration &&
      !query.installations &&
      query.tracking === 'none'
    )
      throw new DoriException('VALIDATION_ERROR');
    const verifySession = () => this.authorization.verifySession(user);
    const verifyBusiness = async () => {
      await verifySession();
      if ((await this.status.getStatus()).deploymentStatus === 'revoked')
        throw new DoriException('INSTALLATION_REVOKED');
    };
    const verifyInstallations = async () => {
      await verifyBusiness();
      if (
        !user.roles.includes('root') &&
        !user.permissions.includes('edge_installation_manage')
      )
        throw new DoriException('FORBIDDEN_PERMISSION');
    };
    const verifyAnnouncementAdministration = async () => {
      await verifySession();
      if (
        !user.roles.includes('root') &&
        !user.permissions.includes('site_edit') &&
        !user.permissions.includes('edge_installation_manage')
      )
        throw new DoriException('FORBIDDEN_PERMISSION');
    };
    // Validate the complete subscription before exposing even the local-status snapshot.
    await verifySession();
    if (queueIds.length || query.installations || query.tracking !== 'none')
      await verifyBusiness();
    for (const queueId of queueIds)
      await this.authorization.verifyDisplay(user, queueId);
    if (query.installations) await verifyInstallations();
    if (query.announcementAdministration)
      await verifyAnnouncementAdministration();
    if (query.tracking === 'direct')
      await this.authorization.verifyTracking(
        query.trackingQueueId!,
        trackingToken,
      );
    if (query.tracking === 'replicated')
      await this.tracking.authorize(trackingToken);
    const expiresAt = new Date((user.accessTokenExpiresAt ?? 0) * 1000);
    const sources: Observable<MessageEvent>[] = [];
    if (query.announcements) {
      const siteId =
        query.tracking === 'replicated'
          ? undefined
          : query.tracking === 'direct'
            ? await this.announcements.siteForQueue(query.trackingQueueId!)
            : query.announcementSiteId;
      sources.push(this.announcements.stream(siteId));
    }
    if (query.announcementAdministration)
      sources.push(
        this.announcements.streamAdministration(
          verifyAnnouncementAdministration,
        ),
      );
    if (query.localStatus)
      sources.push(this.local.stream({ authorize: verifySession, expiresAt }));
    if (query.installations)
      sources.push(
        await this.installations.stream({
          authorize: verifyInstallations,
          expiresAt,
        }),
      );
    for (const queueId of queueIds) {
      sources.push(
        await this.queues.streamDisplay(queueId, undefined, {
          expiresAt,
          authorize: async () => {
            await verifyBusiness();
            await this.authorization.verifyDisplay(user, queueId);
          },
        }),
      );
    }
    if (query.tracking === 'direct') {
      const queueId = query.trackingQueueId!;
      const ticketExpiry = await this.authorization.verifyTracking(
        queueId,
        trackingToken,
      );
      sources.push(
        await this.queues.streamTracking(queueId, undefined, {
          expiresAt: new Date(
            Math.min(expiresAt.getTime(), ticketExpiry.getTime()),
          ),
          authorize: async () => {
            await verifyBusiness();
            await this.authorization.verifyTracking(queueId, trackingToken);
          },
        }),
      );
    }
    if (query.tracking === 'replicated')
      sources.push(await this.tracking.stream(trackingToken));
    return sessionEvents(sources, this.events, this.clock, {
      authorize: verifySession,
      expiresAt,
    });
  }
}
