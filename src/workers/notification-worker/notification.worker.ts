import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ClockService } from '../../core/clock/clock.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private isProcessing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly clockService: ClockService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingNotifications() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const claimTime = this.clockService.now();
      const pending = await this.dataSource.transaction(async (manager) =>
        manager.query(
          `WITH candidates AS (
             SELECT notification_id
             FROM dori_notification
             WHERE attempt_count < 3
               AND (
                 notification_status = 'pending'
                 OR (
                   notification_status = 'processing'
                   AND processing_started_at < $1::timestamptz - INTERVAL '5 minutes'
                 )
               )
             ORDER BY created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 50
           )
           UPDATE dori_notification n
           SET notification_status = 'processing',
               processing_started_at = $1,
               attempt_count = n.attempt_count + 1,
               updated_at = $1
           FROM candidates
           WHERE n.notification_id = candidates.notification_id
           RETURNING n.notification_id, n.channel, n.notification_type,
                     n.recipient, n.notification_content, n.attempt_count`,
          [claimTime],
        ),
      );

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
          await this.dataSource.query(
            `UPDATE dori_notification
             SET notification_status = 'delivered',
                 provider = 'simulation',
                 provider_message_id = $1,
                 sent_at = $2,
                 delivered_at = $2,
                 processing_started_at = NULL,
                 updated_at = $2
             WHERE notification_id = $3`,
            [providerMessageId, now, notif.notification_id],
          );

          this.logger.log(
            `Notification ${notif.notification_id} [${notif.channel}] sent to ${notif.recipient} (msgId: ${providerMessageId})`,
          );
        } catch (err: any) {
          const isFinal = notif.attempt_count >= 3;
          await this.dataSource.query(
            `UPDATE dori_notification
             SET notification_status = $1,
                 failure_reason = $2,
                 processing_started_at = NULL,
                 updated_at = $3
             WHERE notification_id = $4`,
            [
              isFinal ? 'failed' : 'pending',
              err.message,
              now,
              notif.notification_id,
            ],
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
