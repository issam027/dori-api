import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  exhaustMap,
  from,
  interval,
  map,
  merge,
  takeUntil,
  timer,
} from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import { safeErrorName } from '../../core/logging/safe-error';
import { StreamAuthorization } from '../../core/realtime/realtime.service';
import { EdgeControlRepository } from './edge-control.repository';

@Injectable()
export class EdgeInstallationsRealtimeService {
  private readonly logger = new Logger(EdgeInstallationsRealtimeService.name);

  constructor(
    private readonly repository: EdgeControlRepository,
    private readonly clock: ClockService,
  ) {}

  async stream(authorization: StreamAuthorization): Promise<Observable<MessageEvent>> {
    let signature = await this.repository.installationRoomSignature();
    const authorize = async () => {
      if (authorization.expiresAt <= this.clock.now()) throw new Error('Stream authorization expired');
      await authorization.authorize();
    };
    const changes = interval(2_000).pipe(
      exhaustMap(() =>
        from(authorize()).pipe(
          concatMap(() => from(this.repository.installationRoomSignature())),
          exhaustMap((nextSignature) => {
            if (nextSignature === signature) return EMPTY;
            signature = nextSignature;
            return from<MessageEvent[]>([{
              id: randomUUID(),
              type: 'edge_installations_changed',
              retry: 3_000,
              data: { room: 'edge-installations', timestamp: this.clock.now().toISOString() },
            }]);
          }),
          catchError((error: unknown) => {
            this.logger.warn(`Edge installation room polling failed type=${safeErrorName(error)}`);
            return EMPTY;
          }),
        ),
      ),
    );
    const heartbeat = interval(15_000).pipe(
      exhaustMap(() => from(authorize())),
      map(() => ({ type: 'heartbeat', data: { timestamp: this.clock.now().toISOString() } })),
    );
    return merge(changes, heartbeat).pipe(
      catchError(() => EMPTY),
      takeUntil(defer(() => timer(Math.max(0, authorization.expiresAt.getTime() - this.clock.now().getTime())))),
    );
  }
}
