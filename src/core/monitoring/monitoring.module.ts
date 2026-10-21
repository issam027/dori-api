import { Global, Module } from '@nestjs/common';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { ReportsModule } from '../../modules/reports/reports.module';
import { RbacModule } from '../rbac/rbac.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    ClockModule,
    ReportsModule,
    RbacModule,
    RedisModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MonitoringRepository,
    MonitoringService,
    RequestMetricsInterceptor,
  ],
  exports: [MonitoringService, RequestMetricsInterceptor],
})
export class MonitoringModule {}
