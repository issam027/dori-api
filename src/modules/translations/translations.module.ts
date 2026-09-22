import { Module } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  controllers: [TranslationsController],
  providers: [TranslationsService, ClockService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
