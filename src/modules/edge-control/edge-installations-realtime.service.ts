import { Injectable, MessageEvent } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EMPTY,
  Observable,
  auditTime,
  catchError,
  concatMap,
  defer,
  filter,
  ignoreElements,
  interval,
  map,
  merge,
  takeUntil,
  timer,
} from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { readOnChange } from '../../core/realtime/read-on-change';
import { StreamAuthorization } from '../../core/realtime/realtime.service';

@Injectable()
export class EdgeInstallationsRealtimeService {
  constructor(
    private readonly clock: ClockService,
    private readonly databaseEvents: DatabaseEventsService,
  ) {}

  async stream(
    authorization: StreamAuthorization,
  ): Promise<Observable<MessageEvent>> {
    const authorize = async () => {
      if (authorization.expiresAt <= this.clock.now())
        throw new Error('Stream authorization expired');
      await authorization.authorize();
    };
    const changes = this.databaseEvents.changes(['edge-installations']).pipe(
      auditTime(100),
      concatMap(async () => {
        await authorize();
        return {
          id: randomUUID(),
          type: 'edge_installations_changed',
          retry: 3000,
          data: {
            room: 'edge-installations',
            timestamp: this.clock.now().toISOString(),
          },
        };
      }),
    );
    const security = readOnChange(
      this.databaseEvents.changes(['authorization']),
      authorize,
    ).pipe(ignoreElements());
    const heartbeat = interval(15000).pipe(
      filter(() => this.databaseEvents.connected),
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clock.now().toISOString() },
      })),
    );
    return merge(changes, heartbeat, security).pipe(
      catchError(() => EMPTY),
      takeUntil(
        defer(() =>
          timer(
            Math.max(
              0,
              Math.min(
                2147483647,
                authorization.expiresAt.getTime() - this.clock.now().getTime(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
