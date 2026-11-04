import { Injectable, MessageEvent } from '@nestjs/common';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  ignoreElements,
  interval,
  map,
  merge,
  shareReplay,
  takeUntil,
  timer,
} from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { readOnChange } from '../../core/realtime/read-on-change';
import { StreamAuthorization } from '../../core/realtime/realtime.service';
import { EdgeLocalStatusService } from './edge-local-status.service';

@Injectable()
export class EdgeLocalRealtimeService {
  // One read per persisted change and process, shared by all browser connections.
  private readonly snapshots: Observable<
    Awaited<ReturnType<EdgeLocalStatusService['getStatus']>>
  >;

  constructor(
    private readonly status: EdgeLocalStatusService,
    private readonly events: DatabaseEventsService,
    private readonly clock: ClockService,
  ) {
    this.snapshots = readOnChange(
      this.events.changes(['edge-local-status']),
      () => this.status.getStatus(),
    ).pipe(
      distinctUntilChanged(
        (previous, current) =>
          JSON.stringify(previous) === JSON.stringify(current),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  stream(authorization: StreamAuthorization): Observable<MessageEvent> {
    const authorize = async () => {
      if (authorization.expiresAt <= this.clock.now())
        throw new Error('Stream authorization expired');
      await authorization.authorize();
    };
    const snapshots = this.snapshots.pipe(
      concatMap(async (data) => {
        await authorize();
        return { type: 'edge_local_status', data };
      }),
    );
    const security = readOnChange(
      this.events.changes(['authorization']),
      authorize,
    ).pipe(ignoreElements());
    const heartbeat = interval(15000).pipe(
      filter(() => this.events.connected),
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clock.now().toISOString() },
      })),
    );
    return merge(snapshots, security, heartbeat).pipe(
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
