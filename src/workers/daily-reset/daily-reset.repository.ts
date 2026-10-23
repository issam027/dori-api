import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface DailyResetQueueRow {
  queue_id: string;
  carry_over_waiting: boolean | null;
  daily_reset_mode: 'close_all' | 'carry_over_open' | null;
  daily_reset_time: string | null;
  site_id: string;
  timezone: string;
  default_carry_over_waiting: boolean;
  default_daily_reset_mode: 'close_all' | 'carry_over_open';
  default_daily_reset_time: string;
}

export interface ExecuteDailyResetInput {
  queueId: string;
  businessDate: string;
  nextBusinessDate: string;
  trackingValidUntil: Date;
  now: Date;
  carryOverWaiting: boolean;
  resetMode: 'close_all' | 'carry_over_open';
}

@Injectable()
export class DailyResetRepository {
  constructor(private readonly dataSource: DataSource) {}

  findActiveQueues(): Promise<DailyResetQueueRow[]> {
    return this.dataSource.query(
      `SELECT q.queue_id, q.carry_over_waiting, q.daily_reset_mode, q.daily_reset_time,
              s.site_id, s.timezone, s.default_carry_over_waiting,
              s.default_daily_reset_mode, s.default_daily_reset_time
       FROM dorify.dori_queue q JOIN dorify.dori_site s ON s.site_id = q.site_id
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
      const marker = returningRows<{ queue_id: string }>(
        await manager.query(
          `INSERT INTO dorify.dori_queue_daily_reset_execution (queue_id, business_date, executed_at)
         VALUES ($1, $2::date, $3) ON CONFLICT (queue_id, business_date) DO NOTHING RETURNING queue_id`,
          [input.queueId, input.businessDate, input.now],
        ),
      );
      if (!marker.length) return false;

      await manager.query(
        `UPDATE dorify.dori_operator_session SET disconnected_at = $1, closure_reason = 'daily_reset'
         WHERE queue_id = $2 AND disconnected_at IS NULL`,
        [input.now, input.queueId],
      );
      if (input.resetMode === 'close_all' || !input.carryOverWaiting) {
        await manager.query(
          `UPDATE dorify.dori_registration SET status = 'expired', closed_at = $1, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3::date
             AND status IN ('booked', 'waiting', 'in_progress') AND is_active = TRUE`,
          [input.now, input.queueId, input.businessDate],
        );
      } else {
        await manager.query(
          `UPDATE dorify.dori_registration SET status = 'expired', closed_at = $1, updated_at = $1
           WHERE queue_id = $2 AND business_date = $3::date AND is_active = TRUE
             AND status IN ('booked', 'waiting', 'in_progress')
             AND ticket_number LIKE '!%'`,
          [input.now, input.queueId, input.businessDate],
        );
        await manager.query(
          `UPDATE dorify.dori_registration
           SET business_date = $1::date, carried_over_from_date = business_date,
               ticket_number = '!' || ticket_number,
               status = CASE WHEN status = 'in_progress' THEN 'waiting' ELSE status END,
               served_by_session_id = NULL, served_by_user_id = NULL, called_at = NULL,
               registration_tracking_token_valid_until = $3, updated_at = $4
           WHERE queue_id = $5 AND business_date = $2::date
             AND status IN ('booked', 'waiting', 'in_progress')
             AND is_active = TRUE AND ticket_number NOT LIKE '!%'`,
          [
            input.nextBusinessDate,
            input.businessDate,
            input.trackingValidUntil,
            input.now,
            input.queueId,
          ],
        );
      }
      return true;
    });
  }
}
