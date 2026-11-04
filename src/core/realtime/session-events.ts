import { MessageEvent } from '@nestjs/common';
import {
  EMPTY,
  Observable,
  catchError,
  concatWith,
  defer,
  filter,
  ignoreElements,
  interval,
  map,
  merge,
  takeUntil,
  throwError,
  timer,
} from 'rxjs';
import { ClockService } from '../clock/clock.service';
import { DatabaseEventsService } from '../database/database-events.service';
import { readOnChange } from './read-on-change';
import { StreamAuthorization } from './realtime.service';

/** Shared wire protocol for authenticated and public tab subscriptions. */
export function sessionEvents(
  sources: Observable<MessageEvent>[],
  events: DatabaseEventsService,
  clock: ClockService,
  authorization?: StreamAuthorization,
): Observable<MessageEvent> {
  const heartbeat = interval(15000).pipe(
    filter(() => events.connected),
    map(() => ({
      type: 'heartbeat',
      data: { timestamp: clock.now().toISOString() },
    })),
  );
  const security = authorization
    ? readOnChange(
        events.changes(['authorization']),
        authorization.authorize,
      ).pipe(ignoreElements())
    : EMPTY;
  const stream = merge(
    heartbeat,
    security,
    ...sources.map((source) =>
      source.pipe(
        filter((event) => event.type !== 'heartbeat'),
        concatWith(throwError(() => new Error('Realtime subscription ended'))),
      ),
    ),
  ).pipe(catchError(() => EMPTY));
  return authorization
    ? stream.pipe(
        takeUntil(
          defer(() =>
            timer(
              Math.max(
                0,
                Math.min(
                  2147483647,
                  authorization.expiresAt.getTime() - clock.now().getTime(),
                ),
              ),
            ),
          ),
        ),
      )
    : stream;
}
