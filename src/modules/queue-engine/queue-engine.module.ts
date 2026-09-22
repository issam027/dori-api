import { Module } from '@nestjs/common';
import { QueueEngineService } from './queue-engine.service';
import { QueueEngineController } from './queue-engine.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [QueueEngineController],
  providers: [QueueEngineService, ClockService],
  exports: [QueueEngineService],
})
export class QueueEngineModule {}
