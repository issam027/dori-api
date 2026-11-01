import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { runtimeMetrics } from '../observability/runtime-metrics';

@Injectable()
export class PoolObserver
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  constructor(private readonly source: DataSource) {}
  onApplicationBootstrap(): void {
    if (!this.source.isInitialized) return;
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
