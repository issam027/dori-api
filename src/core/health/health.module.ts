import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { HealthRepository } from './health.repository';

@Module({
  imports: [DatabaseModule, ClockModule],
  controllers: [HealthController],
  providers: [HealthRepository],
})
export class HealthModule {}
