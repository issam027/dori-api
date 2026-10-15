import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RbacModule } from '../../core/rbac/rbac.module';
import { DatabaseModule } from '../../core/database/database.module';
import { ReportsRepository } from './reports.repository';

@Module({
  imports: [DatabaseModule, RbacModule],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService],
})
export class ReportsModule {}
