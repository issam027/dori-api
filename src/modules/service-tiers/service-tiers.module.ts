import { Module } from '@nestjs/common';
import { ServiceTiersService } from './service-tiers.service';
import { ServiceTiersController } from './service-tiers.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [ServiceTiersController],
  providers: [ServiceTiersService, ClockService],
  exports: [ServiceTiersService],
})
export class ServiceTiersModule {}
