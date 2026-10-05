import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RbacModule } from '../rbac/rbac.module';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../../modules/auth/auth.module';

@Module({
  imports: [ConfigModule, DatabaseModule, RbacModule, ClockModule, AuthModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
