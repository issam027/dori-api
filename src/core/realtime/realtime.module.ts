import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RbacModule } from '../rbac/rbac.module';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { RealtimeRepository } from './realtime.repository';
import { RealtimeController } from './realtime.controller';
import { JwtSessionRepository } from '../auth/repositories/jwt-session.repository';

@Module({
  imports: [DatabaseModule, RbacModule, ClockModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeRepository, JwtSessionRepository],
  exports: [RealtimeService],
})
export class RealtimeModule {}
