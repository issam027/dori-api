import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './core/auth/jwt-auth.guard';

// Core modules
import { DatabaseModule } from './core/database/database.module';
import { RbacModule } from './core/rbac/rbac.module';
import { RealtimeModule } from './core/realtime/realtime.module';

// Business modules
import { AuthModule } from './modules/auth/auth.module';
import { SitesModule } from './modules/sites/sites.module';
import { QueuesModule } from './modules/queues/queues.module';
import { ServiceTiersModule } from './modules/service-tiers/service-tiers.module';
import { PersonsModule } from './modules/persons/persons.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { QueueEngineModule } from './modules/queue-engine/queue-engine.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TranslationsModule } from './modules/translations/translations.module';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';

// Background workers
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RbacModule,
    RealtimeModule,
    AuthModule,
    SitesModule,
    QueuesModule,
    ServiceTiersModule,
    PersonsModule,
    RegistrationsModule,
    QueueEngineModule,
    NotificationsModule,
    TranslationsModule,
    UsersModule,
    ReportsModule,
    HealthModule,
    WorkersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }
