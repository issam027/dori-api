import { Module } from '@nestjs/common';
import { AppointmentExpiryWorker } from './appointment-expiry/appointment-expiry.worker';
import { DailyResetWorker } from './daily-reset/daily-reset.worker';
import { NotificationWorker } from './notification-worker/notification.worker';
import { ClockModule } from '../core/clock/clock.module';
import { DatabaseModule } from '../core/database/database.module';

@Module({
  imports: [DatabaseModule, ClockModule],
  providers: [AppointmentExpiryWorker, DailyResetWorker, NotificationWorker],
})
export class WorkersModule {}
