import { RbacModule } from '../../core/rbac/rbac.module';
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
import { RealtimeModule } from '../../core/realtime/realtime.module';
import { EdgeLocalRealtimeService } from './edge-local-realtime.service';
import { RealtimeSessionController } from './realtime-session.controller';
import { RealtimeSessionService } from './realtime-session.service';
import { RealtimeSessionGuard } from './realtime-session.guard';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsRepository } from './announcements.repository';
import { LocalAnnouncementsService } from './local-announcements.service';
import { LocalAnnouncementsController } from './local-announcements.controller';
import {
  PublicRealtimeSessionController,
  PublicRealtimeSessionGuard,
} from './public-realtime-session.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ClockModule,
    RealtimeModule,
    RbacModule,
  ],
  controllers: [
    EdgeAgentController,
    EdgeAdminController,
    EdgeLocalController,
    AnnouncementsController,
    LocalAnnouncementsController,
    PublicRealtimeSessionController,
    RealtimeSessionController,
    EdgeInstallationsRealtimeController,
  ],
  providers: [
    EdgeControlRepository,
    EdgeControlService,
    EdgeLocalStatusService,
    AnnouncementsService,
    AnnouncementsRepository,
    LocalAnnouncementsService,
    PublicRealtimeSessionGuard,
    EdgeLocalRealtimeService,
    RealtimeSessionService,
    RealtimeSessionGuard,
    EdgeDeploymentGuard,
    EdgeInstallationsRealtimeService,
  ],
  exports: [EdgeDeploymentGuard, EdgeLocalStatusService],
})
export class EdgeControlModule {}
