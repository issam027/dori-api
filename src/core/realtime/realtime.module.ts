import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ClockService } from '../clock/clock.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_jwt_key_dori_v3_change_in_production_min32chars',
    }),
  ],
  providers: [EventsGateway, ClockService],
  exports: [EventsGateway],
})
export class RealtimeModule {}
