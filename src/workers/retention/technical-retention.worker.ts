import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BaseWorker } from '../base.worker';
import { runtimeMetrics } from '../../core/observability/runtime-metrics';
import { returningRows } from '../../core/database/returning-rows';

export const RETENTION_POLICY = Object.freeze({
  trackingGraceDays: 7,
  outboxDays: 30,
  commandInboxDays: 30,
  batchSize: 500,
});

@Injectable()
export class TechnicalRetentionWorker extends BaseWorker {
  constructor(
    private readonly source: DataSource,
    private readonly config: ConfigService,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async prune(): Promise<void> {
    if (this.config.get<string>('TECHNICAL_RETENTION_ENABLED') === 'false')
      return;
    return this.runOnce(async () => {
      const batches: Array<[string, string, number]> = [
        [
          'tracking',
          `DELETE FROM dorify.dori_public_tracking_state WHERE tracking_token_hash IN (
          SELECT tracking_token_hash FROM dorify.dori_public_tracking_state
          WHERE expires_at<CURRENT_TIMESTAMP-make_interval(days=>$1)
            AND (registration_id IS NULL OR sequence<=cloud_synced_sequence)
          ORDER BY expires_at LIMIT $2 FOR UPDATE SKIP LOCKED
        ) RETURNING tracking_token_hash`,
          RETENTION_POLICY.trackingGraceDays,
        ],
        [
          'outbox',
          `DELETE FROM dorify.dori_realtime_outbox WHERE event_id IN (
          SELECT event_id FROM dorify.dori_realtime_outbox event
          WHERE created_at<CURRENT_TIMESTAMP-make_interval(days=>$1)
            AND NOT EXISTS(SELECT 1 FROM dorify.dori_realtime_topic_state state WHERE state.event_id=event.event_id)
          ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED
        ) RETURNING event_id`,
          RETENTION_POLICY.outboxDays,
        ],
        [
          'commands',
          `DELETE FROM dorify_agent.command_inbox WHERE command_id IN (
          SELECT command_id FROM dorify_agent.command_inbox
          WHERE status!='RUNNING' AND completed_at<CURRENT_TIMESTAMP-make_interval(days=>$1)
          ORDER BY completed_at LIMIT $2 FOR UPDATE SKIP LOCKED
        ) RETURNING command_id`,
          RETENTION_POLICY.commandInboxDays,
        ],
      ];
      for (const [name, sql, days] of batches) {
        const rows: unknown = await this.source.transaction((manager) =>
          manager.query(sql, [days, RETENTION_POLICY.batchSize]),
        );
        // Only counts leave this worker; never tokens or command payloads.
        runtimeMetrics.add('retention_' + name + '_batches_total');
        runtimeMetrics.add(
          'retention_' + name + '_rows_total',
          returningRows(rows).length,
        );
      }
    });
  }
}
