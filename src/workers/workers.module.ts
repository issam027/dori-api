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
import { QueueEstimationWorkerRepository } from './queue-estimation/queue-estimation.repository';
import { RealtimeModule } from '../core/realtime/realtime.module';
import { RealtimeOutboxWorker } from './realtime-outbox/realtime-outbox.worker';

@Module({
  imports: [ConfigModule, DatabaseModule, ClockModule, RealtimeModule],
  providers: [
    AppointmentExpiryWorker,
    DailyResetWorker,
    NotificationWorker,
    NotificationWorkerRepository,
    AppointmentExpiryRepository,
    DailyResetRepository,
    QueueEstimationWorker,
    QueueEstimationWorkerRepository,
    RealtimeOutboxWorker,
  ],
  exports: [
    AppointmentExpiryWorker,
    DailyResetWorker,
    NotificationWorker,
    QueueEstimationWorker,
    RealtimeOutboxWorker,
  ],
})
export class WorkersModule {}
