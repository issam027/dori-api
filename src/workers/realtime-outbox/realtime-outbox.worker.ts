import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { BaseWorker } from '../base.worker';

@Injectable()
export class RealtimeOutboxWorker extends BaseWorker {
  constructor(private readonly realtimeService: RealtimeService) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  handleRealtimeOutbox(): Promise<void> {
    return this.runOnce(() => this.realtimeService.dispatchPending(true));
  }
}
