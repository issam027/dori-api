import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { EdgeAdminController } from './edge-admin.controller';
import { EdgeAgentController } from './edge-agent.controller';
import { EdgeControlRepository } from './edge-control.repository';
import { EdgeControlService } from './edge-control.service';
import { EdgeLocalController } from './edge-local.controller';
import { EdgeLocalStatusService } from './edge-local-status.service';

@Module({
  imports: [ConfigModule, DatabaseModule, ClockModule],
  controllers: [EdgeAgentController, EdgeAdminController, EdgeLocalController],
  providers: [
    EdgeControlRepository,
    EdgeControlService,
    EdgeLocalStatusService,
  ],
})
export class EdgeControlModule {}
