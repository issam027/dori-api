import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [QueuesController],
  providers: [QueuesService, ClockService],
  exports: [QueuesService],
})
export class QueuesModule {}
