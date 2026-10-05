import { Module } from '@nestjs/common';
import { QueueEngineController } from './queue-engine.controller';
import { QueueEngineService } from './queue-engine.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';

@Module({
  imports: [DatabaseModule, ClockModule, RbacModule],
  controllers: [QueueEngineController],
  providers: [QueueEngineService],
  exports: [QueueEngineService],
})
export class QueueEngineModule {}
