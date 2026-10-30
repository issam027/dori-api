import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClockModule } from '../../core/clock/clock.module';
import { DatabaseModule } from '../../core/database/database.module';
import { EdgeAdminController } from './edge-admin.controller';
import { EdgeAgentController } from './edge-agent.controller';
import { EdgeControlRepository } from './edge-control.repository';
import { EdgeControlService } from './edge-control.service';

@Module({
  imports: [ConfigModule, DatabaseModule, ClockModule],
  controllers: [EdgeAgentController, EdgeAdminController],
  providers: [EdgeControlRepository, EdgeControlService],
})
export class EdgeControlModule {}
