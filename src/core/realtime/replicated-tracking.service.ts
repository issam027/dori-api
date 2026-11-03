import { Injectable, MessageEvent } from '@nestjs/common';
import { createHash } from 'crypto';
import { isUUID } from 'class-validator';
import { DatabaseEventsService } from '../database/database-events.service';
import { readOnChange } from './read-on-change';
import { runtimeMetrics } from '../observability/runtime-metrics';
import {
  EMPTY,
  Observable,
  catchError,
  concat,
  defer,
  exhaustMap,
  finalize,
  interval,
  map,
  merge,
  of,
  shareReplay,
  tap,
  switchMap,
  timer,
  throwError,
  mergeMap,
  filter,
} from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { DoriException } from '../errors/dori.exception';
import {
  RealtimeRepository,
  ReplicatedTrackingRow,
} from './realtime.repository';

@Injectable()
export class ReplicatedTrackingService {
  private readonly topics = new Map<
    string,
    Observable<ReplicatedTrackingRow>
  >();

  constructor(
    private readonly repository: RealtimeRepository,
    private readonly clock: ClockService,
    private readonly databaseEvents: DatabaseEventsService,
  ) {}

  private async read(hash: string): Promise<ReplicatedTrackingRow> {
    runtimeMetrics.add('sse_replicated_tracking_reads_total');
    const row = await this.repository.findReplicatedTracking(hash);
    if (
      !row ||
      row.deployment_status !== 'active' ||
      this.clock.parse(row.expires_at) <= this.clock.now()
    ) {
      throw new DoriException('TOKEN_EXPIRED');
    }
    return row;
  }

  async authorize(
    token: string,
  ): Promise<{ hash: string; row: ReplicatedTrackingRow }> {
    if (!token || !isUUID(token)) throw new DoriException('UNAUTHENTICATED');
    const hash = createHash('sha256').update(token).digest('hex');
    // Validate before sending SSE headers, including on every reconnect.
    return { hash, row: await this.read(hash) };
  }

  async stream(token: string): Promise<Observable<MessageEvent>> {
    const { hash, row: initial } = await this.authorize(token);
    let version = '';
    const snapshots = concat(
      of(initial),
      defer(() => this.topic(hash)),
    ).pipe(
      exhaustMap((row) => {
        const next =
          String(row.sequence) +
          ':' +
          row.source_connectivity +
          ':' +
          (row.language_preference ?? '');
        if (next === version) return EMPTY;
        version = next;
        return of({
          id: String(row.sequence),
          type: 'tracking_changed',
          retry: 3000,
          data: {
            languagePreference: row.language_preference ?? 'fr',
            ticketNumber: row.ticket_number,
            status: row.registration_status,
            registrationStatus: row.registration_status,
            position: row.position,
            estimatedWaitMinutes: row.estimated_wait_minutes,
            counterName: row.counter_name,
            queueName: row.queue_public_name,
            observedAt: new Date(row.observed_at).toISOString(),
            sourceConnectivity: row.source_connectivity,
          },
        });
      }),
    );
    const heartbeat = interval(15000).pipe(
      filter(() => this.databaseEvents.connected),
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clock.now().toISOString() },
      })),
    );
    // Projection/installation changes and exact expiry timers close revoked credentials.
    return merge(snapshots, heartbeat).pipe(catchError(() => EMPTY));
  }

  private topic(hash: string): Observable<ReplicatedTrackingRow> {
    const existing = this.topics.get(hash);
    if (existing) return existing;
    // Subscribe before reading; installation metadata extends timers without SQL reads.
    let current: ReplicatedTrackingRow | undefined;
    const topic = new Observable<ReplicatedTrackingRow>((subscriber) => {
      let installationSubscription: { unsubscribe(): void } | undefined;
      const trackingSubscription = readOnChange(
        this.databaseEvents.changes(['tracking:' + hash]),
        () => this.read(hash),
      ).subscribe({
        next: (row) => {
          const installationChanged =
            current?.source_installation_id !== row.source_installation_id;
          current = row;
          subscriber.next(row);
          if (installationChanged || !installationSubscription) {
            installationSubscription?.unsubscribe();
            installationSubscription = this.databaseEvents
              .changes(['installation:' + row.source_installation_id])
              .subscribe((change) => {
                if (!current || change.key === 'recovery') return;
                if (change.status !== 'active') {
                  subscriber.error(new DoriException('TOKEN_EXPIRED'));
                  return;
                }
                current = {
                  ...current,
                  source_last_seen_at: change.seenAt,
                  source_connectivity:
                    change.seenAt &&
                    Date.parse(change.seenAt) + 120000 >
                      this.clock.now().getTime()
                      ? 'online'
                      : 'offline',
                };
                subscriber.next(current);
              });
          }
        },
        error: (error: unknown) => subscriber.error(error),
      });
      return () => {
        trackingSubscription.unsubscribe();
        installationSubscription?.unsubscribe();
      };
    }).pipe(
      switchMap((row) => {
        const expiryMs = Math.max(
          0,
          this.clock.parse(row.expires_at).getTime() -
            this.clock.now().getTime(),
        );
        const expiry = timer(Math.min(2_147_483_647, expiryMs)).pipe(
          mergeMap(() => throwError(() => new DoriException('TOKEN_EXPIRED'))),
        );
        const offlineMs = row.source_last_seen_at
          ? Math.max(
              0,
              this.clock.parse(row.source_last_seen_at).getTime() +
                120000 -
                this.clock.now().getTime(),
            )
          : 120000;
        return merge(
          of(row),
          expiry,
          ...(row.source_connectivity === 'online'
            ? [
                timer(offlineMs).pipe(
                  map(() => ({
                    ...row,
                    source_connectivity: 'offline' as const,
                  })),
                ),
              ]
            : []),
        );
      }),
      tap({ error: () => this.topics.delete(hash) }),
      finalize(() => this.topics.delete(hash)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.topics.set(hash, topic);
    return topic;
  }
}
