import { NotificationsModule } from '../modules/notifications/notifications.module';
import { ThresholdWorker } from './notification-worker/threshold.worker';
import { TechnicalRetentionWorker } from './retention/technical-retention.worker';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppointmentExpiryWorker } from './appointment-expiry/appointment-expiry.worker';
import { DailyResetWorker } from './daily-reset/daily-reset.worker';
import { NotificationWorker } from './notification-worker/notification.worker';
import { ClockModule } from '../core/clock/clock.module';
import { DatabaseModule } from '../core/database/database.module';
import { NotificationWorkerRepository } from './notification-worker/notification-worker.repository';
import { AppointmentExpiryRepository } from './appointment-expiry/appointment-expiry.repository';
import { DailyResetRepository } from './daily-reset/daily-reset.repository';
import { QueueEstimationWorker } from './queue-estimation/queue-estimation.worker';
import { QueueEstimationModule } from '../modules/queue-estimation/queue-estimation.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ClockModule,
    NotificationsModule,
    QueueEstimationModule,
  ],
  providers: [
    AppointmentExpiryWorker,
    DailyResetWorker,
    NotificationWorker,
    ThresholdWorker,
    TechnicalRetentionWorker,
    NotificationWorkerRepository,
    AppointmentExpiryRepository,
    DailyResetRepository,
    QueueEstimationWorker,
  ],
  exports: [
    AppointmentExpiryWorker,
    DailyResetWorker,
    NotificationWorker,
    QueueEstimationWorker,
    TechnicalRetentionWorker,
  ],
})
export class WorkersModule {}
