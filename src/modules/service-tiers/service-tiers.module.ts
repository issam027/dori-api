import { Module } from '@nestjs/common';
import { ServiceTiersController } from './service-tiers.controller';
import { ServiceTiersService } from './service-tiers.service';
import { ClockModule } from '../../core/clock/clock.module';

@Module({
  imports: [ClockModule],
  controllers: [ServiceTiersController],
  providers: [ServiceTiersService],
  exports: [ServiceTiersService],
})
export class ServiceTiersModule {}
