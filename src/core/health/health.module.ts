import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, ClockModule],
  controllers: [HealthController],
})
export class HealthModule {}
