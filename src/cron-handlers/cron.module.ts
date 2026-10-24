import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkersModule } from '../workers/workers.module';
import { CronController } from './cron.controller';

@Module({
  imports: [ConfigModule, WorkersModule],
  controllers: [CronController],
})
export class CronModule {}
