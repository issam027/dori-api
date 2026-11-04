import { Injectable, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import {
  Observable,
  auditTime,
  concatMap,
  finalize,
  Subject,
  distinctUntilChanged,
  map,
  merge,
  shareReplay,
} from 'rxjs';
import { ClockService } from '../../core/clock/clock.service';
import { DatabaseEventsService } from '../../core/database/database-events.service';
import { readOnChange } from '../../core/realtime/read-on-change';
import { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementItemDto } from './dto/announcement.dto';

function parseAnnouncements(value: unknown): AnnouncementItemDto[] {
  if (typeof value !== 'string') return [];
  try {
    const data: unknown = JSON.parse(value);
    if (!Array.isArray(data) || data.length > 50) return [];
    return data.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      if (
        typeof item.announcementId !== 'string' ||
        !isUUID(item.announcementId) ||
        typeof item.title !== 'string' ||
        !item.title.trim() ||
        item.title.length > 120 ||
        typeof item.message !== 'string' ||
        !item.message.trim() ||
        item.message.length > 2000 ||
        !['info', 'warning', 'critical'].includes(String(item.severity)) ||
        typeof item.startsAt !== 'string' ||
        typeof item.endsAt !== 'string' ||
        !Number.isFinite(Date.parse(item.startsAt)) ||
        !Number.isFinite(Date.parse(item.endsAt))
      )
        return [];
      return [
        {
          announcementId: item.announcementId,
          title: item.title,
          message: item.message,
          severity: item.severity as AnnouncementItemDto['severity'],
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

@Injectable()
export class LocalAnnouncementsService {
  private administration?: Observable<void>;
  private readonly topics = new Map<
    string,
    Observable<{ items: AnnouncementItemDto[]; observedAt: string }>
  >();
  constructor(
    private readonly database: DataSource,
    private readonly events: DatabaseEventsService,
    private readonly clock: ClockService,
    private readonly config: ConfigService,
    private readonly repository: AnnouncementsRepository,
  ) {}
  async siteForQueue(queueId: string): Promise<string | undefined> {
    const [row] = (await this.database.query(
      'SELECT site_id FROM dorify.dori_queue WHERE queue_id=$1 AND is_active=TRUE',
      [queueId],
    )) as Array<{ site_id: string }>;
    return row?.site_id;
  }
  async read(siteId?: string): Promise<{
    items: AnnouncementItemDto[];
    observedAt: string;
    nextChange?: number;
  }> {
    const now = this.clock.now();
    const [stored, site] = await Promise.all([
      this.config.get<string>('deployment.mode') === 'intra'
        ? (this.database.query(
            "SELECT state_value FROM dorify_agent.agent_state WHERE state_key='installation_announcements'",
          ) as Promise<Array<{ state_value: string }>>)
        : Promise.resolve([] as Array<{ state_value: string }>),
      siteId ? this.repository.forSite(siteId, now) : Promise.resolve([]),
    ]);
    const all = [
      ...new Map(
        [...parseAnnouncements(stored[0]?.state_value), ...site].map((item) => [
          item.announcementId,
          item,
        ]),
      ).values(),
    ];
    const time = this.clock.now().getTime();
    const deadlines = all
      .flatMap((item) => [Date.parse(item.startsAt), Date.parse(item.endsAt)])
      .filter((date) => date > time);
    const priority = { critical: 0, warning: 1, info: 2 };
    return {
      items: all
        .filter(
          (item) =>
            Date.parse(item.startsAt) <= time && Date.parse(item.endsAt) > time,
        )
        .sort(
          (a, b) =>
            priority[a.severity] - priority[b.severity] ||
            a.startsAt.localeCompare(b.startsAt),
        ),
      observedAt: this.clock.now().toISOString(),
      nextChange: deadlines.length ? Math.min(...deadlines) : undefined,
    };
  }
  stream(siteId?: string): Observable<MessageEvent> {
    const key = siteId ?? 'installation';
    let topic = this.topics.get(key);
    if (!topic) {
      topic = new Observable<{
        items: AnnouncementItemDto[];
        observedAt: string;
      }>((subscriber) => {
        const deadlines = new Subject<void>();
        let timer: NodeJS.Timeout | undefined;
        const subscription = readOnChange(
          merge(this.events.changes(['announcements']), deadlines),
          () => this.read(siteId),
        ).subscribe({
          next: ({ items, observedAt, nextChange }) => {
            if (timer) clearTimeout(timer);
            if (nextChange !== undefined) {
              timer = setTimeout(
                () => deadlines.next(),
                Math.max(
                  0,
                  Math.min(
                    2147483647,
                    nextChange - this.clock.now().getTime() + 10,
                  ),
                ),
              );
              timer.unref();
            }
            subscriber.next({ items, observedAt });
          },
          error: (error: unknown) => subscriber.error(error),
        });
        return () => {
          subscription.unsubscribe();
          if (timer) clearTimeout(timer);
          deadlines.complete();
        };
      }).pipe(
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        finalize(() => this.topics.delete(key)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.topics.set(key, topic);
    }
    return topic.pipe(map((data) => ({ type: 'announcements', data })));
  }
  streamAdministration(
    authorize: () => Promise<void>,
  ): Observable<MessageEvent> {
    if (!this.administration) {
      this.administration = new Observable<void>((subscriber) => {
        const deadlines = new Subject<void>();
        let timer: NodeJS.Timeout | undefined;
        const subscription = readOnChange(
          merge(this.events.changes(['announcements']), deadlines),
          () => this.repository.nextBoundary(this.clock.now()),
        ).subscribe({
          next: (boundary) => {
            if (timer) clearTimeout(timer);
            if (boundary !== undefined) {
              timer = setTimeout(
                () => deadlines.next(),
                Math.max(
                  10,
                  Math.min(
                    2147483647,
                    boundary - this.clock.now().getTime() + 10,
                  ),
                ),
              );
              timer.unref();
            }
            subscriber.next();
          },
          error: (error: unknown) => subscriber.error(error),
        });
        return () => {
          subscription.unsubscribe();
          if (timer) clearTimeout(timer);
          deadlines.complete();
        };
      }).pipe(
        finalize(() => {
          this.administration = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.administration.pipe(
      auditTime(100),
      concatMap(async () => {
        await authorize();
        return {
          type: 'announcements_changed',
          data: { timestamp: this.clock.now().toISOString() },
        };
      }),
    );
  }
}
