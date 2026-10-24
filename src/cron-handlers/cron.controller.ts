import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../core/auth/decorators/public.decorator';
import { AppointmentExpiryWorker } from '../workers/appointment-expiry/appointment-expiry.worker';
import { DailyResetWorker } from '../workers/daily-reset/daily-reset.worker';
import { NotificationWorker } from '../workers/notification-worker/notification.worker';
import { QueueEstimationWorker } from '../workers/queue-estimation/queue-estimation.worker';

@Public()
@Controller('api/internal/cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly dailyReset: DailyResetWorker,
    private readonly appointmentExpiry: AppointmentExpiryWorker,
    private readonly notificationWorker: NotificationWorker,
    private readonly queueEstimation: QueueEstimationWorker,
  ) {}

  private async run(
    authorization: string | undefined,
    task: () => Promise<void>,
  ) {
    const secret = this.config.get<string>('cron.secret');
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
    await task();
    return { accepted: true };
  }

  @Get('daily-reset')
  @HttpCode(HttpStatus.OK)
  dailyResetCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () => this.dailyReset.handleDailyReset());
  }

  @Get('appointment-expiry')
  @HttpCode(HttpStatus.OK)
  appointmentExpiryCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.appointmentExpiry.handleAppointmentExpiry(),
    );
  }

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  notificationCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.notificationWorker.processPendingNotifications(),
    );
  }

  @Get('queue-estimation')
  @HttpCode(HttpStatus.OK)
  queueEstimationCron(@Headers('authorization') authorization?: string) {
    return this.run(authorization, () =>
      this.queueEstimation.handleQueueEstimation(),
    );
  }
}
