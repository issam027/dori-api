import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../../core/auth/jwt.strategy';
import { ClockService } from '../../core/clock/clock.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_jwt_key_dori_v3_change_in_production_min32chars',
      signOptions: { expiresIn: '3600s' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ClockService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
