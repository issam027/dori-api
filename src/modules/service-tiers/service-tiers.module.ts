import { Module } from '@nestjs/common';
import { ServiceTiersController } from './service-tiers.controller';
import { ServiceTiersService } from './service-tiers.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';

@Module({
  imports: [DatabaseModule, ClockModule, RbacModule],
  controllers: [ServiceTiersController],
  providers: [ServiceTiersService],
  exports: [ServiceTiersService],
})
export class ServiceTiersModule {}
