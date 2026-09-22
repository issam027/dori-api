import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService, ClockService],
  exports: [PersonsService],
})
export class PersonsModule {}
