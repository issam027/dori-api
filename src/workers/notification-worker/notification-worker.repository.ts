import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface ClaimedNotificationRow {
  notification_id: string;
  channel: 'sms' | 'email';
  notification_type: 'welcome' | 'threshold';
  recipient: string;
  notification_content: string | null;
  attempt_count: number;
}

@Injectable()
export class NotificationWorkerRepository {
  constructor(private readonly dataSource: DataSource) {}

  findThresholdQueues(): Promise<Array<{ queue_id: string }>> {
    return this.dataSource.query(
      `SELECT DISTINCT r.queue_id FROM dorify.dori_registration r
       JOIN dorify.dori_queue q ON q.queue_id=r.queue_id AND q.is_active
       JOIN dorify.dori_site s ON s.site_id=q.site_id AND s.is_active
       WHERE r.status = 'waiting' AND r.is_active = TRUE
         AND EXISTS (
           SELECT 1 FROM dorify.dori_queue_tier_notification_rule rule
           JOIN dorify.dori_queue_service_tier tier
             ON tier.queue_id = rule.queue_id AND tier.tier_id = rule.tier_id
           WHERE rule.queue_id = r.queue_id AND rule.notification_type = 'threshold'
             AND rule.tier_id=r.tier_id
             AND rule.is_active = TRUE AND tier.is_active = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM dorify.dori_notification n
               WHERE n.registration_id=r.registration_id AND n.notification_type='threshold' AND n.channel=rule.channel
             )
         )
       ORDER BY r.queue_id`,
    );
  }

  async claimPending(claimTime: Date): Promise<ClaimedNotificationRow[]> {
    const raw: unknown = await this.dataSource.transaction((manager) =>
      manager.query(
        `WITH candidates AS (
           SELECT notification_id
           FROM dorify.dori_notification
           WHERE (
               notification_status = 'pending'
               OR (
                 notification_status = 'processing'
                 AND processing_started_at < $1::timestamptz - INTERVAL '5 minutes'
               )
             )
             AND dispatch_route = 'direct'
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 50
         )
         , updated AS (
         UPDATE dorify.dori_notification n
         SET notification_status = CASE WHEN n.attempt_count >= 3 THEN 'failed' ELSE 'processing' END,
             failure_reason = CASE WHEN n.attempt_count >= 3 THEN 'PROCESSING_LEASE_EXPIRED' ELSE n.failure_reason END,
             processing_started_at = CASE WHEN n.attempt_count >= 3 THEN NULL ELSE $1 END,
             attempt_count = CASE WHEN n.attempt_count >= 3 THEN n.attempt_count ELSE n.attempt_count + 1 END,
             updated_at = $1
         FROM candidates
         WHERE n.notification_id = candidates.notification_id
         RETURNING n.notification_id, n.channel, n.notification_type,
                   n.recipient, n.notification_content, n.attempt_count, n.notification_status
         ) SELECT * FROM updated WHERE notification_status = 'processing'`,
        [claimTime],
      ),
    );

    // Depending on the TypeORM/pg execution path, UPDATE ... RETURNING can be
    // returned as rows directly or as [rows, affectedCount].
    return returningRows<ClaimedNotificationRow>(raw);
  }

  async markDelivered(
    notificationId: string,
    providerMessageId: string,
    now: Date,
    attemptCount: number,
  ): Promise<boolean> {
    const result: unknown = await this.dataSource.query(
      `UPDATE dorify.dori_notification
       SET notification_status = 'delivered', provider = 'simulation',
           provider_message_id = $1, sent_at = $2, delivered_at = $2,
           processing_started_at = NULL, updated_at = $2
       WHERE notification_id = $3 AND notification_status = 'processing' AND attempt_count = $4
       RETURNING notification_id`,
      [providerMessageId, now, notificationId, attemptCount],
    );
    return returningRows(result).length > 0;
  }

  async markAttemptFailed(
    notificationId: string,
    finalAttempt: boolean,
    reason: string,
    now: Date,
    attemptCount: number,
  ): Promise<boolean> {
    const result: unknown = await this.dataSource.query(
      `UPDATE dorify.dori_notification
       SET notification_status = $1, failure_reason = $2,
           processing_started_at = NULL, updated_at = $3
       WHERE notification_id = $4 AND notification_status = 'processing' AND attempt_count = $5
       RETURNING notification_id`,
      [
        finalAttempt ? 'failed' : 'pending',
        reason,
        now,
        notificationId,
        attemptCount,
      ],
    );
    return returningRows(result).length > 0;
  }
}
