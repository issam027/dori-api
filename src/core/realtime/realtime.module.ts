import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RbacModule } from '../rbac/rbac.module';
import { ClockModule } from '../clock/clock.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { RealtimeRepository } from './realtime.repository';
import { isVercelRuntime } from '../config/configuration';
import { WsAuthService } from './ws-auth.service';

const gatewayProviders = isVercelRuntime() ? [] : [RealtimeGateway];

@Module({
  imports: [ConfigModule, DatabaseModule, RbacModule, ClockModule, AuthModule],
  providers: [
    ...gatewayProviders,
    RealtimeService,
    RealtimeRepository,
    WsAuthService,
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
