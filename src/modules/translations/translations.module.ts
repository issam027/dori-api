import { Module } from '@nestjs/common';
import { TranslationsController } from './translations.controller';
import { TranslationsService } from './translations.service';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { RealtimeModule } from '../../core/realtime/realtime.module';
import { TranslationsRepository } from './translations.repository';

@Module({
  imports: [DatabaseModule, ClockModule, RealtimeModule],
  controllers: [TranslationsController],
  providers: [TranslationsService, TranslationsRepository],
  exports: [TranslationsService],
})
export class TranslationsModule {}
