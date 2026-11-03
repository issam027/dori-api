import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { Observable, Subject, filter, merge } from 'rxjs';
import { postgresClientConfig } from './postgres-connection';
import { runtimeMetrics } from '../observability/runtime-metrics';

export interface DatabaseChange {
  key: string;
  seenAt?: string;
  status?: string;
}

/** One session connection per API process, never one connection per browser/topic. */
@Injectable()
export class DatabaseEventsService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseEventsService.name);
  private readonly notifications = new Subject<DatabaseChange>();
  private readonly recovery = new Subject<DatabaseChange>();
  private client?: Client;
  private reconnect?: NodeJS.Timeout;
  private safety?: NodeJS.Timeout;
  private stopped = false;
  private lastRecovery = 0;
  private attempts = 0;
  private readonly deadlines = new Map<string, NodeJS.Timeout>();
  connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<boolean>('swaggerExport')) return;
    await this.connect();
    this.safety = setInterval(() => {
      const safetyMs =
        this.config.get<number>('database.realtimeSafetyMs') ?? 300_000;
      if (!this.connected || Date.now() - this.lastRecovery >= safetyMs) {
        this.lastRecovery = Date.now();
        this.recovery.next({ key: 'recovery' });
      }
    }, 30_000);
    this.safety.unref();
  }

  changes(keys: readonly string[]): Observable<DatabaseChange> {
    const selected = new Set(keys);
    return merge(
      this.notifications.pipe(filter((change) => selected.has(change.key))),
      this.recovery,
    );
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new Client({
      ...postgresClientConfig({
        DATABASE_URL: this.config.getOrThrow<string>('database.listenUrl'),
      }),
      application_name: 'dorify-api-listener',
      connectionTimeoutMillis:
        this.config.get<number>('database.connectionTimeoutMs') ?? 5000,
      statement_timeout: 5000,
      query_timeout: 6000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
    this.client = client;
    const disconnected = () => {
      if (this.client !== client) return;
      this.client = undefined;
      this.connected = false;
      runtimeMetrics.set('database_listener_connected', 0);
      void client.end().catch(() => undefined);
      if (this.stopped || this.reconnect) return;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempts++, 5));
      this.reconnect = setTimeout(
        () => {
          this.reconnect = undefined;
          void this.connect();
        },
        delay * (0.8 + Math.random() * 0.4),
      );
      this.reconnect.unref();
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on('notification', (message) => {
      if (message.channel !== 'dorify_realtime' || !message.payload) return;
      try {
        const change: unknown = JSON.parse(message.payload);
        if (!change || typeof change !== 'object') return;
        const value = change as Record<string, unknown>;
        if (typeof value.key !== 'string') return;
        if (value.key.startsWith('installation:')) {
          this.scheduleDeadline(
            value.key,
            value.status === 'active' && typeof value.seenAt === 'string'
              ? Date.parse(value.seenAt) + 120000
              : undefined,
          );
        }
        if (
          value.key === 'edge-installations' &&
          typeof value.commandId === 'string'
        ) {
          this.scheduleDeadline(
            'command:' + value.commandId,
            typeof value.expiresAt === 'string'
              ? Date.parse(value.expiresAt)
              : undefined,
          );
        }
        this.notifications.next({
          key: value.key,
          seenAt: typeof value.seenAt === 'string' ? value.seenAt : undefined,
          status: typeof value.status === 'string' ? value.status : undefined,
        });
      } catch {
        this.logger.warn('Invalid database realtime notification');
      }
    });
    try {
      await client.connect();
      await client.query('LISTEN dorify_realtime');
      if (this.stopped || this.client !== client) {
        await client.end();
        return;
      }
      this.connected = true;
      this.attempts = 0;
      this.lastRecovery = Date.now();
      runtimeMetrics.set('database_listener_connected', 1);
      // LISTEN is committed before subscribers inspect state: catch events missed offline.
      this.recovery.next({ key: 'recovery' });
    } catch {
      this.logger.warn(
        'Database realtime listener unavailable; recovery mode enabled',
      );
      disconnected();
    }
  }

  private scheduleDeadline(key: string, deadline?: number): void {
    const previous = this.deadlines.get(key);
    if (previous) clearTimeout(previous);
    this.deadlines.delete(key);
    if (deadline === undefined || !Number.isFinite(deadline)) return;
    const timer = setTimeout(
      () => {
        this.deadlines.delete(key);
        this.notifications.next({ key: 'edge-installations' });
      },
      Math.max(0, Math.min(2147483647, deadline - Date.now() + 50)),
    );
    timer.unref();
    this.deadlines.set(key, timer);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.reconnect) clearTimeout(this.reconnect);
    if (this.safety) clearInterval(this.safety);
    this.deadlines.forEach((timer) => clearTimeout(timer));
    this.deadlines.clear();
    const client = this.client;
    this.client = undefined;
    this.connected = false;
    await client?.end().catch(() => undefined);
    this.notifications.complete();
    this.recovery.complete();
  }
}
