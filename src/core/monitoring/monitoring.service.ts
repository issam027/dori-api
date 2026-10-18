import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { MonitoringRepository } from './monitoring.repository';
import { ScopeService } from '../rbac/services/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../errors/dori.exception';

@Injectable()
export class MonitoringService {
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly repository: MonitoringRepository,
    private readonly clockService: ClockService,
    private readonly scopeService: ScopeService,
  ) {}

  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
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

  metrics() {
    const counters = Object.fromEntries(this.counters);
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

  async live(siteId: number, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const snapshot = await this.repository.liveSnapshot(siteId);
    if (!snapshot.site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    const queues: Array<{
      queueId: number;
      queueName: string;
      waiting: number;
      inProgress: number;
      openDesks: number;
      activeOperators: number;
      estimatedWaitMinutes: number | null;
      longestWaitMinutes: number | null;
    }> = snapshot.queues.map((row: Record<string, unknown>) => ({
      queueId: Number(row.queue_id),
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
    const operators: Array<{ userId: number; [key: string]: unknown }> =
      snapshot.operators.map((row: Record<string, unknown>) => ({
        userId: Number(row.user_id),
        displayName: String(row.display_name),
        queueIds: [Number(row.queue_id)],
        sessionId: Number(row.session_id),
        ...(row.counter_name ? { counterName: String(row.counter_name) } : {}),
        ...(row.thread_number != null
          ? { threadNumber: Number(row.thread_number) }
          : {}),
        startedAt: new Date(row.connected_at as string | Date).toISOString(),
        ...(canViewRegistrations && row.registration_id != null
          ? {
              currentRegistrationId: Number(row.registration_id),
              currentTicketNumber: String(row.ticket_number),
            }
          : {}),
      }));
    const alerts = queues.flatMap<{
      code: string;
      severity: 'info' | 'warning' | 'critical';
      queueId?: number;
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
