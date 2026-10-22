import { Global, Module } from '@nestjs/common';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { RbacModule } from '../../core/rbac/rbac.module';
import { RedisModule } from '../../core/redis/redis.module';

@Global()
@Module({
  imports: [DatabaseModule, ClockModule, RbacModule, RedisModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringRepository,
    MonitoringService,
    ReportsRepository,
    ReportsService,
    RequestMetricsInterceptor,
  ],
  exports: [MonitoringService, ReportsService, RequestMetricsInterceptor],
})
export class MonitoringModule {}
