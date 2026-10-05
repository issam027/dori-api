import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';
import { SitesRepository } from './sites.repository';

@Module({
  imports: [DatabaseModule, ClockModule, RbacModule],
  controllers: [SitesController],
  providers: [SitesService, SitesRepository],
  exports: [SitesService],
})
export class SitesModule {}
