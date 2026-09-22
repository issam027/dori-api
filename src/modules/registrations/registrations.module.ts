import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [RegistrationsController],
  providers: [RegistrationsService, ClockService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
