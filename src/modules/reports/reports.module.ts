import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { RbacModule } from '../../core/rbac/rbac.module';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, RbacModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
