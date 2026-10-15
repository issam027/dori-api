import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationTemplateService } from './notification-template.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationTemplateService],
  exports: [NotificationTemplateService],
})
export class NotificationTemplateModule {}
