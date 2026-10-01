import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { RbacModule } from '../../core/rbac/rbac.module';
import { ClockModule } from '../../core/clock/clock.module';

@Module({
  imports: [RbacModule, ClockModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
