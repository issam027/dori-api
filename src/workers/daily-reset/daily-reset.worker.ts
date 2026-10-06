import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ClockService } from '../../core/clock/clock.service';

@Injectable()
export class DailyResetWorker {
  private readonly logger = new Logger(DailyResetWorker.name);
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly clockService: ClockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDailyReset() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = this.clockService.now();

      // Fetch all active sites and queues
      const queues = await this.dataSource.query(`
        SELECT q.queue_id, q.carry_over_waiting, q.daily_reset_mode, q.daily_reset_time,
               s.site_id, s.timezone, s.default_carry_over_waiting, s.default_daily_reset_mode, s.default_daily_reset_time
        FROM dori_site_queue_thread q
        JOIN dori_site s ON s.site_id = q.site_id
        WHERE q.is_active = TRUE AND s.is_active = TRUE
      `);

      for (const q of queues) {
        const timezone = q.timezone || 'Africa/Tunis';
        const targetResetTime =
          q.daily_reset_time || q.default_daily_reset_time || '03:00';

        // Check if current local time in that timezone matches targetResetTime (HH:mm)
        const localTimeStr = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now);

        const targetHm = targetResetTime.slice(0, 5);
        if (localTimeStr !== targetHm) {
          continue;
        }

        const businessDate = this.clockService.yesterdayInTimezone(timezone);
        const nextBusinessDate = this.clockService.todayInTimezone(timezone);
        const shouldCarryOver =
          q.carry_over_waiting !== null
            ? q.carry_over_waiting
            : (q.default_carry_over_waiting ?? false);
        const resetMode =
          q.daily_reset_mode || q.default_daily_reset_mode || 'close_all';

        await this.dataSource.transaction(async (manager) => {
          const lock = await manager.query(
            `SELECT pg_try_advisory_xact_lock(hashtext($1), $2) AS acquired`,
            ['daily-reset', q.queue_id],
          );
          if (!lock[0]?.acquired) return;

          const marker = await manager.query(
            `INSERT INTO dori_queue_daily_reset (queue_id, business_date, executed_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (queue_id, business_date) DO NOTHING
             RETURNING queue_id`,
            [q.queue_id, businessDate, now],
          );
          if (marker.length === 0) return;

          this.logger.log(
            `Executing daily reset for queue ${q.queue_id} and business date ${businessDate}`,
          );

          // 1. Close open sessions (§4.8)
          await manager.query(
            `UPDATE dori_queue_session
             SET disconnected_at = $1, closure_reason = 'daily_reset'
             WHERE queue_id = $2 AND disconnected_at IS NULL`,
            [now, q.queue_id],
          );

          // 2. Process waiting/booked registrations of the closing day
          if (!shouldCarryOver) {
            await manager.query(
              `UPDATE dori_registration
               SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
               WHERE queue_id = $2 AND business_date = $3 AND status IN ('booked', 'waiting') AND is_active = TRUE`,
              [now, q.queue_id, businessDate],
            );
          } else {
            // Carry over: tickets already OLD- expire
            await manager.query(
              `UPDATE dori_registration
               SET status = 'expired', closed_at = $1, is_active = FALSE, updated_at = $1
               WHERE queue_id = $2 AND business_date = $3 AND status IN ('booked', 'waiting') AND is_active = TRUE
                 AND ticket_number LIKE 'OLD-%'`,
              [now, q.queue_id, businessDate],
            );

            // Remaining waiting tickets get carry over: ticket_number = 'OLD-' || ticket_number
            await manager.query(
              `UPDATE dori_registration
               SET business_date = $1, carried_over_from_date = $2, ticket_number = 'OLD-' || ticket_number,
                   registration_tracking_token_valid_until = $3, updated_at = $4
               WHERE queue_id = $5 AND business_date = $2 AND status IN ('booked', 'waiting') AND is_active = TRUE
                 AND ticket_number NOT LIKE 'OLD-%'`,
              [
                nextBusinessDate,
                businessDate,
                this.clockService.addDays(now, 1),
                now,
                q.queue_id,
              ],
            );
          }

          // 3. Neutralize closed registrations per resetMode
          if (resetMode === 'close_all') {
            await manager.query(
              `UPDATE dori_registration
               SET is_active = FALSE, deleted_at = $1, updated_at = $1
               WHERE queue_id = $2 AND business_date = $3 AND status IN ('served', 'no_show', 'expired', 'cancelled') AND is_active = TRUE`,
              [now, q.queue_id, businessDate],
            );
          } else if (resetMode === 'close_served_only') {
            await manager.query(
              `UPDATE dori_registration
               SET is_active = FALSE, deleted_at = $1, updated_at = $1
               WHERE queue_id = $2 AND business_date = $3 AND status = 'served' AND is_active = TRUE`,
              [now, q.queue_id, businessDate],
            );
          }
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Error in daily reset worker: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
