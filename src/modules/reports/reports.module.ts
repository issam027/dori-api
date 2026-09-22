import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ClockService],
  exports: [ReportsService],
})
export class ReportsModule {}
