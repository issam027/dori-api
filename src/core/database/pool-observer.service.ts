import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { runtimeMetrics } from '../observability/runtime-metrics';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PoolObserver
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  constructor(
    private readonly source: DataSource,
    private readonly config: ConfigService,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    if (!this.source.isInitialized) return;
    const capacity: Array<{ max_connections: number }> =
      await this.source.query(
        "SELECT setting::int AS max_connections FROM pg_settings WHERE name='max_connections'",
      );
    const budget = this.config.get<number>('database.maxConnections') ?? 100;
    if (capacity[0] && budget > capacity[0].max_connections)
      throw new Error('DB_MAX_CONNECTIONS exceeds PostgreSQL max_connections');
    runtimeMetrics.set(
      'database_connections_budget',
      this.config.get<number>('database.maxConnections') ?? 100,
    );
    runtimeMetrics.set(
      'database_connections_allocated',
      this.config.get<number>('database.allocatedConnections') ?? 31,
    );
    runtimeMetrics.set(
      'database_pool_max',
      this.config.get<number>('database.poolMax') ?? 10,
    );
    this.timer = setInterval(() => {
      const driver = this.source.driver as unknown as {
        master?: {
          totalCount: number;
          idleCount: number;
          waitingCount: number;
        };
      };
      if (!driver.master) return;
      runtimeMetrics.set('database_pool_total', driver.master.totalCount);
      runtimeMetrics.set('database_pool_idle', driver.master.idleCount);
      runtimeMetrics.set('database_pool_waiting', driver.master.waitingCount);
    }, 5000);
    this.timer.unref();
  }
  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
