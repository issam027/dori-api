import { Module } from '@nestjs/common';
import { WorkersModule } from '../workers/workers.module';
import { CronController } from './cron.controller';

@Module({ imports: [WorkersModule], controllers: [CronController] })
export class CronModule {}
