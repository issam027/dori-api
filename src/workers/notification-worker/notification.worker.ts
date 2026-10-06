import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ClockService } from '../../core/clock/clock.service';
import { NotificationWorkerRepository } from './notification-worker.repository';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private isProcessing = false;

  constructor(
    private readonly repository: NotificationWorkerRepository,
    private readonly clockService: ClockService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingNotifications() {
    if (this.isProcessing) return;
    this.isProcessing = true;

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

          this.logger.log(
            `Notification ${notif.notification_id} [${notif.channel}] sent to ${notif.recipient} (msgId: ${providerMessageId})`,
          );
        } catch (err: any) {
          const isFinal = notif.attempt_count >= 3;
          await this.repository.markAttemptFailed(
            notif.notification_id,
            isFinal,
            err.message,
            now,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error processing notifications: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
