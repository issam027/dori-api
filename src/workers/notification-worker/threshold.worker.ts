import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { safeErrorName } from '../../core/logging/safe-error';
import { BaseWorker } from '../base.worker';
import { NotificationWorkerRepository } from './notification-worker.repository';

@Injectable()
export class ThresholdWorker extends BaseWorker {
  private readonly logger = new Logger(ThresholdWorker.name);
  constructor(
    private readonly repository: NotificationWorkerRepository,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async evaluateThresholds(): Promise<void> {
    return this.runOnce(async () => {
      const queues = await this.repository.findThresholdQueues();
      for (const queue of queues) {
        try {
          await this.notifications.evaluateQueueThresholds(queue.queue_id);
        } catch (error: unknown) {
          this.logger.warn(
            `Threshold evaluation failed type=${safeErrorName(error)}`,
          );
        }
      }
    });
  }
}
