import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../../core/clock/clock.service';
import { DailyResetRepository } from './daily-reset.repository';
import { BaseWorker } from '../base.worker';
import { DEFAULT_TIMEZONE } from '../../core/config/configuration';

@Injectable()
export class DailyResetWorker extends BaseWorker {
  private readonly logger = new Logger(DailyResetWorker.name);

  constructor(
    private readonly repository: DailyResetRepository,
    private readonly clockService: ClockService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDailyReset() {
    return this.runOnce(async () => {
      try {
        const now = this.clockService.now();
        const queues = await this.repository.findActiveQueues();
        for (const queue of queues) {
          const timezone =
            queue.timezone ||
            this.configService.get<string>('defaults.timezone') ||
            DEFAULT_TIMEZONE;
          const resetTime =
            queue.daily_reset_time || queue.default_daily_reset_time || '03:00';
          const localTime = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(now);
          if (localTime !== resetTime.slice(0, 5)) continue;

          const businessDate = this.clockService.yesterdayInTimezone(timezone);
          const executed = await this.repository.execute({
            queueId: queue.queue_id,
            businessDate,
            nextBusinessDate: this.clockService.todayInTimezone(timezone),
            trackingValidUntil: this.clockService.addDays(now, 1),
            now,
            carryOverWaiting:
              queue.carry_over_waiting ??
              queue.default_carry_over_waiting ??
              false,
            resetMode:
              queue.daily_reset_mode ||
              queue.default_daily_reset_mode ||
              'close_all',
          });
          if (executed) {
            this.logger.log(
              `Executed daily reset for queue ${queue.queue_id} and business date ${businessDate}`,
            );
          }
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `Error in daily reset worker: ${err.message}`,
          err.stack,
        );
      }
    });
  }
}
