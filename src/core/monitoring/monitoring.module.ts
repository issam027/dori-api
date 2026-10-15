import { Global, Module } from '@nestjs/common';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { ReportsModule } from '../../modules/reports/reports.module';

@Global()
@Module({
  imports: [DatabaseModule, ClockModule, ReportsModule],
  controllers: [MonitoringController],
  providers: [
    MonitoringRepository,
    MonitoringService,
    RequestMetricsInterceptor,
  ],
  exports: [MonitoringService, RequestMetricsInterceptor],
})
export class MonitoringModule {}
