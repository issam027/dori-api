import { Injectable, MessageEvent } from '@nestjs/common';
import { createHash } from 'crypto';
import { isUUID } from 'class-validator';
import {
  EMPTY,
  Observable,
  catchError,
  concat,
  defer,
  exhaustMap,
  finalize,
  from,
  interval,
  map,
  merge,
  of,
  shareReplay,
  tap,
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
  ) {}

  private async read(hash: string): Promise<ReplicatedTrackingRow> {
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
        const next = String(row.sequence) + ':' + row.source_connectivity;
        if (next === version) return EMPTY;
        version = next;
        return of({
          id: String(row.sequence),
          type: 'tracking_changed',
          retry: 3000,
          data: {
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
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: this.clock.now().toISOString() },
      })),
    );
    // Authorization is rechecked by the shared topic every two seconds. On failure,
    // terminate the stream rather than leaking stale data after headers were sent.
    return merge(snapshots, heartbeat).pipe(catchError(() => EMPTY));
  }

  private topic(hash: string): Observable<ReplicatedTrackingRow> {
    const existing = this.topics.get(hash);
    if (existing) return existing;
    // Same shared topic strategy as the queue SSE: one indexed read per ticket,
    // independent of the number of open tabs, compatible with multiple API instances.
    const topic = interval(2000).pipe(
      exhaustMap(() => from(this.read(hash))),
      tap({ error: () => this.topics.delete(hash) }),
      finalize(() => this.topics.delete(hash)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.topics.set(hash, topic);
    return topic;
  }
}
