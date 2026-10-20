import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { PersonsModule } from '../persons/persons.module';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RbacModule } from '../../core/rbac/rbac.module';
import { RegistrationsRepository } from './registrations.repository';
import { ConfigModule } from '@nestjs/config';
import { NotificationTemplateModule } from '../../core/notifications/notification-template.module';
import { QueueEstimationModule } from '../queue-estimation/queue-estimation.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ClockModule,
    RbacModule,
    PersonsModule,
    NotificationTemplateModule,
    QueueEstimationModule,
  ],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationsRepository],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
