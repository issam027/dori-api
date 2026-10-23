import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { ClockService } from '../../core/clock/clock.service';
import { MonitoringRepository } from './monitoring.repository';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { REDIS_CLIENT } from '../../core/redis/redis.module';
import type Redis from 'ioredis';

const METRICS_HASH_KEY = 'dori:metrics:counters';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly repository: MonitoringRepository,
    private readonly clockService: ClockService,
    private readonly scopeService: ScopeService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  private isRedisReady(): boolean {
    return Boolean(
      this.redis && (!this.redis.status || this.redis.status === 'ready'),
    );
  }

  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
    if (this.isRedisReady() && this.redis) {
      this.redis
        .hincrbyfloat(METRICS_HASH_KEY, name, value)
        .catch((err: Error) => {
          this.logger.debug(
            `Failed to increment Redis metric ${name}: ${err.message}`,
          );
        });
    }
  }

  async health() {
    const database = (await this.repository.isDatabaseAvailable())
      ? ('up' as const)
      : ('down' as const);
    return {
      status: database === 'up' ? ('ok' as const) : ('degraded' as const),
      timestamp: this.clockService.now().toISOString(),
      uptime: process.uptime(),
      checks: { database, memoryUsage: process.memoryUsage() },
    };
  }

  async metrics() {
    let counters: Record<string, number> = {};

    if (this.isRedisReady() && this.redis) {
      try {
        const raw = await this.redis.hgetall(METRICS_HASH_KEY);
        if (raw && Object.keys(raw).length > 0) {
          for (const [key, val] of Object.entries(raw)) {
            counters[key] = Number(val);
          }
        } else {
          counters = Object.fromEntries(this.counters);
        }
      } catch (err) {
        this.logger.debug(
          `Failed to fetch metrics from Redis: ${(err as Error).message}`,
        );
        counters = Object.fromEntries(this.counters);
      }
    } else {
      counters = Object.fromEntries(this.counters);
    }

    const requests = counters.http_requests_total ?? 0;
    const totalDuration = counters.http_request_duration_ms_total ?? 0;
    return {
      counters,
      derived: {
        averageHttpRequestDurationMs:
          requests > 0 ? totalDuration / requests : 0,
      },
      generatedAt: this.clockService.now().toISOString(),
    };
  }

  async activity() {
    return {
      ...(await this.repository.activitySnapshot()),
      generatedAt: this.clockService.now().toISOString(),
    };
  }

  async live(siteId: string, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const snapshot = await this.repository.liveSnapshot(siteId);
    if (!snapshot.site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    const queues: Array<{
      queueId: string;
      queueName: string;
      waiting: number;
      inProgress: number;
      openDesks: number;
      activeOperators: number;
      estimatedWaitMinutes: number | null;
      longestWaitMinutes: number | null;
    }> = snapshot.queues.map((row: Record<string, unknown>) => ({
      queueId: String(row.queue_id),
      queueName: String(row.queue_name),
      waiting: Number(row.waiting ?? 0),
      inProgress: Number(row.in_progress ?? 0),
      openDesks: Number(row.open_desks ?? 0),
      activeOperators: Number(row.active_operators ?? 0),
      estimatedWaitMinutes:
        row.estimated_wait_minutes == null
          ? null
          : Number(row.estimated_wait_minutes),
      longestWaitMinutes:
        row.longest_wait_minutes == null
          ? null
          : Number(row.longest_wait_minutes),
    }));
    const canViewRegistrations =
      user.permissions?.includes('registration_view');
    const operators: Array<{ userId: string; [key: string]: unknown }> =
      snapshot.operators.map((row: Record<string, unknown>) => ({
        userId: String(row.user_id),
        displayName: String(row.display_name),
        queueIds: [String(row.queue_id)],
        sessionId: String(row.session_id),
        ...(row.counter_name ? { counterName: String(row.counter_name) } : {}),
        ...(row.thread_number != null
          ? { threadNumber: Number(row.thread_number) }
          : {}),
        startedAt: new Date(row.connected_at as string | Date).toISOString(),
        ...(canViewRegistrations && row.registration_id != null
          ? {
              currentRegistrationId: String(row.registration_id),
              currentTicketNumber: String(row.ticket_number),
            }
          : {}),
      }));
    const alerts = queues.flatMap<{
      code: string;
      severity: 'info' | 'warning' | 'critical';
      queueId?: string;
      messageKey: string;
      translationParams?: Record<string, string | number>;
    }>((queue) => {
      if (queue.longestWaitMinutes != null && queue.longestWaitMinutes >= 30) {
        return [
          {
            code: 'LONG_WAIT',
            severity: 'critical' as const,
            queueId: queue.queueId,
            messageKey: 'monitoring.alert.long_wait',
            translationParams: { minutes: queue.longestWaitMinutes },
          },
        ];
      }
      if (queue.waiting >= 10) {
        return [
          {
            code: 'QUEUE_PRESSURE',
            severity: 'warning' as const,
            queueId: queue.queueId,
            messageKey: 'monitoring.alert.queue_pressure',
            translationParams: { waiting: queue.waiting },
          },
        ];
      }
      return [];
    });
    const longest = queues
      .map((queue) => queue.longestWaitMinutes)
      .filter((value): value is number => value != null);
    return {
      generatedAt: this.clockService.now().toISOString(),
      siteId,
      timezone: snapshot.site.timezone,
      totals: {
        waiting: queues.reduce((sum, queue) => sum + queue.waiting, 0),
        inProgress: queues.reduce((sum, queue) => sum + queue.inProgress, 0),
        activeQueues: queues.length,
        openDesks: queues.reduce((sum, queue) => sum + queue.openDesks, 0),
        activeOperators: new Set(operators.map((operator) => operator.userId))
          .size,
        longestWaitMinutes: longest.length ? Math.max(...longest) : null,
      },
      queues,
      operators,
      alerts,
    };
  }
}
