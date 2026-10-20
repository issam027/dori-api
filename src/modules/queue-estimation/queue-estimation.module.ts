import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { QueueWaitEstimationRepository } from './queue-wait-estimation.repository';
import { QueueWaitEstimationService } from './queue-wait-estimation.service';

@Module({
  imports: [DatabaseModule],
  providers: [QueueWaitEstimationRepository, QueueWaitEstimationService],
  exports: [QueueWaitEstimationService],
})
export class QueueEstimationModule {}
