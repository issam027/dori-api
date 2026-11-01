import { ClockModule } from '../../core/clock/clock.module';
import { QueueStatisticsRepository } from './queue-statistics.repository';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { QueueWaitEstimationRepository } from './queue-wait-estimation.repository';
import { QueueWaitEstimationService } from './queue-wait-estimation.service';

@Module({
  imports: [DatabaseModule, ClockModule],
  providers: [
    QueueWaitEstimationRepository,
    QueueWaitEstimationService,
    QueueStatisticsRepository,
  ],
  exports: [QueueWaitEstimationService, QueueStatisticsRepository],
})
export class QueueEstimationModule {}
