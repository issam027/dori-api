import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ClockService } from '../../core/clock/clock.service';
import { NotificationWorkerRepository } from './notification-worker.repository';
import { MonitoringService } from '../../modules/monitoring/monitoring.service';
import { safeErrorName } from '../../core/logging/safe-error';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private isProcessing = false;

  constructor(
    private readonly repository: NotificationWorkerRepository,
    private readonly clockService: ClockService,
    private readonly metricsService: MonitoringService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingNotifications() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.metricsService.increment('notification_worker_runs_total');

    try {
      const claimTime = this.clockService.now();
      const pending = await this.repository.claimPending(claimTime);

      if (!pending || pending.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${pending.length} pending notification(s)`);

      for (const notif of pending) {
        const now = this.clockService.now();
        const providerMessageId = `msg_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        try {
          // In production, an external SMS provider (e.g. Twilio, Infobip) or SMTP is called here.
          // In this operational environment, we simulate immediate successful dispatch:
          await this.repository.markDelivered(
            notif.notification_id,
            providerMessageId,
            now,
          );
          this.metricsService.increment('notifications_delivered_total');

          this.logger.log(
            `Notification ${notif.notification_id} channel=${notif.channel} delivered`,
          );
        } catch (err: unknown) {
          const isFinal = notif.attempt_count >= 3;
          await this.repository.markAttemptFailed(
            notif.notification_id,
            isFinal,
            safeErrorName(err),
            now,
          );
          this.metricsService.increment('notification_delivery_failures_total');
        }
      }
    } catch (err: unknown) {
      this.metricsService.increment('notification_worker_errors_total');
      this.logger.error(
        `Notification worker failed type=${safeErrorName(err)}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
