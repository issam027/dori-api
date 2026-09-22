import { Module } from '@nestjs/common';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, ClockService],
  exports: [SitesService],
})
export class SitesModule {}
