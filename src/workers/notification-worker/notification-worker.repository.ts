import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface ClaimedNotificationRow {
  notification_id: number;
  channel: 'sms' | 'email';
  notification_type: 'welcome' | 'threshold';
  recipient: string;
  notification_content: string | null;
  attempt_count: number;
}

@Injectable()
export class NotificationWorkerRepository {
  constructor(private readonly dataSource: DataSource) {}

  async claimPending(claimTime: Date): Promise<ClaimedNotificationRow[]> {
    const raw: unknown = await this.dataSource.transaction((manager) =>
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

    // Depending on the TypeORM/pg execution path, UPDATE ... RETURNING can be
    // returned as rows directly or as [rows, affectedCount].
    return returningRows<ClaimedNotificationRow>(raw);
  }

  async markDelivered(
    notificationId: number,
    providerMessageId: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dori_notification
       SET notification_status = 'delivered', provider = 'simulation',
           provider_message_id = $1, sent_at = $2, delivered_at = $2,
           processing_started_at = NULL, updated_at = $2
       WHERE notification_id = $3`,
      [providerMessageId, now, notificationId],
    );
  }

  async markAttemptFailed(
    notificationId: number,
    finalAttempt: boolean,
    reason: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE dori_notification
       SET notification_status = $1, failure_reason = $2,
           processing_started_at = NULL, updated_at = $3
       WHERE notification_id = $4`,
      [finalAttempt ? 'failed' : 'pending', reason, now, notificationId],
    );
  }
}
