import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as pg from 'pg';
import { ALL_ENTITIES } from './entities';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        driver: pg,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        schema: 'dorify',
        ssl: configService.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
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
          max: configService.get<number>('database.poolMax') ?? 10,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
  ],
  providers: [DatabaseSeedService],
  exports: [TypeOrmModule, DatabaseSeedService],
})
export class DatabaseModule {}
