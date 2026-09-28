import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import configuration from './core/config/configuration';
import { DatabaseModule } from './core/database/database.module';
import { ClockModule } from './core/clock/clock.module';
import { RbacModule } from './core/rbac/rbac.module';
import { AuthModule } from './modules/auth/auth.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { HealthModule } from './core/health/health.module';

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
import { WorkersModule } from './workers/workers.module';

import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './core/rbac/guards/permissions.guard';
import { CorrelationIdInterceptor } from './core/http/correlation-id.interceptor';
import { ResponseInterceptor } from './core/response/response.interceptor';
import { SerializationInterceptor } from './core/serialization/serialization.interceptor';
import { GlobalExceptionFilter } from './core/errors/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttle.default.ttl') || 60000,
          limit: config.get<number>('throttle.default.limit') || 200,
        },
        {
          name: 'strict',
          ttl: config.get<number>('throttle.strict.ttl') || 60000,
          limit: config.get<number>('throttle.strict.limit') || 20,
        },
        {
          name: 'auth',
          ttl: config.get<number>('throttle.auth.ttl') || 60000,
          limit: config.get<number>('throttle.auth.limit') || 10,
        },
      ],
    }),
    DatabaseModule,
    ClockModule,
    RbacModule,
    AuthModule,
    RealtimeModule,
    HealthModule,
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
    WorkersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SerializationInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
