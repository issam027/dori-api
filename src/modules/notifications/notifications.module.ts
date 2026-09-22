import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ClockService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
