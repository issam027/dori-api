import { Module } from '@nestjs/common';
import { QueuesController } from './queues.controller';
import { QueuesService } from './queues.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';
import { QueuesRepository } from './queues.repository';
import { QueueEstimationModule } from '../queue-estimation/queue-estimation.module';

@Module({
  imports: [DatabaseModule, ClockModule, RbacModule, QueueEstimationModule],
  controllers: [QueuesController],
  providers: [QueuesService, QueuesRepository],
  exports: [QueuesService],
})
export class QueuesModule {}
