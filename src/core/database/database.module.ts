import { PoolObserver } from './pool-observer.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as pg from 'pg';
import { ALL_ENTITIES } from './entities';
import { DatabaseSeedService } from './database-seed.service';
import { DatabaseEventsService } from './database-events.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        driver: pg,
        url: configService.getOrThrow<string>('database.url'),
        schema: 'dorify',
        ssl: configService.get<false | { rejectUnauthorized: false }>(
          'database.ssl',
          false,
        ),
        entities: ALL_ENTITIES,
        synchronize: false,
        manualInitialization:
          configService.get<boolean>('swaggerExport') ?? false,
        logging:
          configService.get<string>('nodeEnv') === 'development'
            ? ['error', 'warn']
            : false,
        // Configurable for the database provider and deployment topology.
        // Neon pooled connections support concurrency; keep the deployment
        // value explicit when several serverless instances can scale out.
        extra: {
          application_name: 'dorify-api',
          max: configService.get<number>('database.poolMax') ?? 10,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis:
            configService.get<number>('database.connectionTimeoutMs') ?? 5000,
          statement_timeout:
            configService.get<number>('database.statementTimeoutMs') ?? 30000,
          query_timeout:
            (configService.get<number>('database.statementTimeoutMs') ??
              30000) + 5000,
          lock_timeout:
            configService.get<number>('database.lockTimeoutMs') ?? 3000,
          idle_in_transaction_session_timeout:
            configService.get<number>('database.idleTransactionTimeoutMs') ??
            15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        },
      }),
    }),
  ],
  providers: [DatabaseSeedService, PoolObserver, DatabaseEventsService],
  exports: [TypeOrmModule, DatabaseSeedService, DatabaseEventsService],
})
export class DatabaseModule {}
