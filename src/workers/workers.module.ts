import { Module } from '@nestjs/common';
import { DailyResetService } from './daily-reset.service';
import { AppointmentExpiryService } from './appointment-expiry.service';
import { NotificationWorkerService } from './notification-worker.service';
import { ClockService } from '../core/clock/clock.service';

@Module({
  providers: [
    DailyResetService,
    AppointmentExpiryService,
    NotificationWorkerService,
    ClockService,
  ],
  exports: [
    DailyResetService,
    AppointmentExpiryService,
    NotificationWorkerService,
  ],
})
export class WorkersModule {}
