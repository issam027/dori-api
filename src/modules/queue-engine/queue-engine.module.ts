import { Module } from '@nestjs/common';
import { QueueEngineController } from './queue-engine.controller';
import { QueueEngineService } from './queue-engine.service';
import { ClockModule } from '../../core/clock/clock.module';

@Module({
  imports: [ClockModule],
  controllers: [QueueEngineController],
  providers: [QueueEngineService],
  exports: [QueueEngineService],
})
export class QueueEngineModule {}
