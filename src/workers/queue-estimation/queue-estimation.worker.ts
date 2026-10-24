import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClockService } from '../../core/clock/clock.service';
import { QueueEstimationWorkerRepository } from './queue-estimation.repository';
import { safeErrorName } from '../../core/logging/safe-error';
import { BaseWorker } from '../base.worker';

@Injectable()
export class QueueEstimationWorker extends BaseWorker {
  private readonly logger = new Logger(QueueEstimationWorker.name);

  constructor(
    private readonly repository: QueueEstimationWorkerRepository,
    private readonly clockService: ClockService,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleQueueEstimation(): Promise<void> {
    return this.runOnce(async () => {
      try {
        this.logger.debug('Running queue estimation worker...');
        const now = this.clockService.now();
        const queues = await this.repository.findActiveQueues();
        for (const queue of queues) {
          try {
            await this.repository.aggregateQueue({
              siteId: queue.site_id,
              queueId: queue.queue_id,
              activityDate: this.clockService.dateInTimezone(
                now,
                queue.timezone,
              ),
              now,
            });
          } catch (error: unknown) {
            this.logger.error(
              `Queue estimation failed queueId=${queue.queue_id} type=${safeErrorName(error)}`,
            );
          }
        }
      } catch (error: unknown) {
        this.logger.error(
          `Queue estimation worker failed type=${safeErrorName(error)}`,
        );
      }
    });
  }
}
