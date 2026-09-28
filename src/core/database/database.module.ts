import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ALL_ENTITIES } from './entities';
import { DatabaseSeedService } from './database-seed.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        ssl: configService.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
        entities: ALL_ENTITIES,
        synchronize: false,
        logging:
          configService.get<string>('nodeEnv') === 'development'
            ? ['error', 'warn']
            : false,
      }),
    }),
  ],
  providers: [DatabaseSeedService],
  exports: [TypeOrmModule, DatabaseSeedService],
})
export class DatabaseModule {}
