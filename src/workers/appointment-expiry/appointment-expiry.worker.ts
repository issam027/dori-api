import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClockService } from '../../core/clock/clock.service';
import { AppointmentExpiryRepository } from './appointment-expiry.repository';
import { safeErrorName } from '../../core/logging/safe-error';

@Injectable()
export class AppointmentExpiryWorker {
  private readonly logger = new Logger(AppointmentExpiryWorker.name);
  private isRunning = false;

  constructor(
    private readonly repository: AppointmentExpiryRepository,
    private readonly clockService: ClockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAppointmentExpiry() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.logger.debug('Running appointment expiry worker...');

      // Mark expired all booked/rescheduled appointments that exceeded late tolerance (§4.3)
      const now = this.clockService.now();
      const rows = await this.repository.expireLateAppointments(now);
      if (rows && rows.length > 0) {
        this.logger.log(`Expired ${rows.length} late appointment(s)`);
      }
    } catch (err: unknown) {
      this.logger.error(
        `Appointment expiry worker failed type=${safeErrorName(err)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
