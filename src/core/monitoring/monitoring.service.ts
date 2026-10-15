import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { MonitoringRepository } from './monitoring.repository';

@Injectable()
export class MonitoringService {
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly repository: MonitoringRepository,
    private readonly clockService: ClockService,
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
}
