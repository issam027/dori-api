import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ClockModule } from '../clock/clock.module';

@Module({
  imports: [ClockModule],
  controllers: [HealthController],
})
export class HealthModule {}

