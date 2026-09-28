import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private isProcessing = false;

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingNotifications() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Pick pending notifications with attempt_count < 3
      const pending = await this.dataSource.query(`
        SELECT notification_id, channel, notification_type, recipient, notification_content, attempt_count
        FROM dori_notification
        WHERE notification_status = 'pending' AND attempt_count < 3
        ORDER BY created_at ASC
        LIMIT 50
      `);

      if (!pending || pending.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${pending.length} pending notification(s)`);

      for (const notif of pending) {
        const now = new Date();
        const providerMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

        try {
          // In production, an external SMS provider (e.g. Twilio, Infobip) or SMTP is called here.
          // In this operational environment, we simulate immediate successful dispatch:
          await this.dataSource.query(
            `UPDATE dori_notification
             SET notification_status = 'delivered',
                 provider_message_id = $1,
                 sent_at = $2,
                 delivered_at = $2,
                 attempt_count = attempt_count + 1,
                 updated_at = $2
             WHERE notification_id = $3`,
            [providerMessageId, now, notif.notification_id],
          );

          this.logger.log(
            `Notification ${notif.notification_id} [${notif.channel}] sent to ${notif.recipient} (msgId: ${providerMessageId})`,
          );
        } catch (err: any) {
          const isFinal = notif.attempt_count + 1 >= 3;
          await this.dataSource.query(
            `UPDATE dori_notification
             SET notification_status = $1,
                 failure_reason = $2,
                 attempt_count = attempt_count + 1,
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
