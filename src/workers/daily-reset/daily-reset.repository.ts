import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface DailyResetQueueRow {
  queue_id: number;
  carry_over_waiting: boolean | null;
  daily_reset_mode: 'close_all' | 'close_served_only' | null;
  daily_reset_time: string | null;
  site_id: number;
  timezone: string;
  default_carry_over_waiting: boolean;
  default_daily_reset_mode: 'close_all' | 'close_served_only';
  default_daily_reset_time: string;
}

export interface ExecuteDailyResetInput {
  queueId: number;
  businessDate: string;
  nextBusinessDate: string;
  trackingValidUntil: Date;
  now: Date;
  carryOverWaiting: boolean;
  resetMode: 'close_all' | 'close_served_only';
}

@Injectable()
export class DailyResetRepository {
  constructor(private readonly dataSource: DataSource) {}

  findActiveQueues(): Promise<DailyResetQueueRow[]> {
    return this.dataSource.query(
      `SELECT q.queue_id, q.carry_over_waiting, q.daily_reset_mode, q.daily_reset_time,
              s.site_id, s.timezone, s.default_carry_over_waiting,
              s.default_daily_reset_mode, s.default_daily_reset_time
       FROM dori_site_queue_thread q JOIN dori_site s ON s.site_id = q.site_id
       WHERE q.is_active = TRUE AND s.is_active = TRUE`,
    );
  }

  execute(input: ExecuteDailyResetInput): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const lock = returningRows<{ acquired: boolean }>(
        await manager.query(
          'SELECT pg_try_advisory_xact_lock(hashtext($1), $2) AS acquired',
          ['daily-reset', input.queueId],
        ),
      );
      if (!lock[0]?.acquired) return false;
      const marker = returningRows<{ queue_id: number }>(
        await manager.query(
          `INSERT INTO dori_queue_daily_reset (queue_id, business_date, executed_at)
         VALUES ($1, $2::date, $3) ON CONFLICT (queue_id, business_date) DO NOTHING RETURNING queue_id`,
          [input.queueId, input.businessDate, input.now],
        ),
      );
      if (!marker.length) return false;

      await manager.query(
        `UPDATE dori_queue_session SET disconnected_at = $1, closure_reason = 'daily_reset'
         WHERE queue_id = $2 AND disconnected_at IS NULL`,
        [input.now, input.queueId],
      );
      if (!input.carryOverWaiting) {
        await manager.query(
          `UPDATE dori_registration SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3::date AND status IN ('booked', 'waiting') AND is_active = TRUE`,
          [input.now, input.queueId, input.businessDate],
        );
      } else {
        await manager.query(
          `UPDATE dori_registration SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3::date AND status IN ('booked', 'waiting')
             AND is_active = TRUE AND ticket_number LIKE 'OLD-%'`,
          [input.now, input.queueId, input.businessDate],
        );
        await manager.query(
          `UPDATE dori_registration
           SET business_date = $1::date, carried_over_from_date = $2::date,
               ticket_number = 'OLD-' || ticket_number,
               registration_tracking_token_valid_until = $3, updated_at = $4
           WHERE queue_id = $5 AND business_date = $2::date AND status IN ('booked', 'waiting')
             AND is_active = TRUE AND ticket_number NOT LIKE 'OLD-%'`,
          [
            input.nextBusinessDate,
            input.businessDate,
            input.trackingValidUntil,
            input.now,
            input.queueId,
          ],
        );
      }
      const status =
        input.resetMode === 'close_all'
          ? "status IN ('served', 'no_show', 'expired', 'cancelled')"
          : "status = 'served'";
      await manager.query(
        `UPDATE dori_registration SET is_active = FALSE, deleted_at = $1, updated_at = $1
         WHERE queue_id = $2 AND business_date = $3::date AND ${status} AND is_active = TRUE`,
        [input.now, input.queueId, input.businessDate],
      );
      return true;
    });
  }
}
