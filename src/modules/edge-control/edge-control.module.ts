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
import { EdgeDeploymentGuard } from './edge-deployment.guard';
import { EdgeInstallationsRealtimeController } from './edge-installations-realtime.controller';
import { EdgeInstallationsRealtimeService } from './edge-installations-realtime.service';
import { JwtSessionRepository } from '../../core/auth/repositories/jwt-session.repository';

@Module({
  imports: [ConfigModule, DatabaseModule, ClockModule],
  controllers: [EdgeAgentController, EdgeAdminController, EdgeLocalController, EdgeInstallationsRealtimeController],
  providers: [
    EdgeControlRepository,
    EdgeControlService,
    EdgeLocalStatusService,
    EdgeDeploymentGuard,
    EdgeInstallationsRealtimeService,
    JwtSessionRepository,
  ],
  exports: [EdgeDeploymentGuard, EdgeLocalStatusService],
})
export class EdgeControlModule {}
