import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  JwtPayload,
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';
import { JwtSessionRepository } from '../repositories/jwt-session.repository';
import { ClockService } from '../../clock/clock.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly jwtSessionRepository: JwtSessionRepository,
    private readonly clockService: ClockService,
  ) {
    const algorithm = configService.get<'HS256' | 'RS256'>('jwt.algorithm');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        algorithm === 'RS256'
          ? configService.getOrThrow<string>('jwt.publicKey')
          : configService.getOrThrow<string>('jwt.secret'),
      algorithms: [algorithm ?? 'HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sid) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const sessionId = await this.jwtSessionRepository.findValidSessionId(
      payload.sid,
      payload.sub,
      this.clockService.now(),
    );

    if (!sessionId) {
      throw new DoriException('UNAUTHENTICATED');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      userType: payload.userType || 'human',
      sessionId,
      accessTokenExpiresAt: payload.exp,
    };
  }
}
