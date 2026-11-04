import { RealtimeAuthorizationService } from './realtime-authorization.service';
import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RbacModule } from '../rbac/rbac.module';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { RealtimeRepository } from './realtime.repository';
import { RealtimeController } from './realtime.controller';
import { JwtSessionRepository } from '../auth/repositories/jwt-session.repository';
import { ReplicatedTrackingController } from './replicated-tracking.controller';
import { ReplicatedTrackingService } from './replicated-tracking.service';
import { ReplicatedTrackingGuard } from './replicated-tracking.guard';

@Module({
  imports: [DatabaseModule, RbacModule, ClockModule],
  controllers: [RealtimeController, ReplicatedTrackingController],
  providers: [
    RealtimeService,
    RealtimeRepository,
    JwtSessionRepository,
    RealtimeAuthorizationService,
    ReplicatedTrackingService,
    ReplicatedTrackingGuard,
  ],
  exports: [
    RealtimeService,
    RealtimeAuthorizationService,
    ReplicatedTrackingService,
  ],
})
export class RealtimeModule {}
