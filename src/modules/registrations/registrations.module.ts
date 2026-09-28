import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { PersonsModule } from '../persons/persons.module';
import { ClockModule } from '../../core/clock/clock.module';

@Module({
  imports: [PersonsModule, ClockModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
