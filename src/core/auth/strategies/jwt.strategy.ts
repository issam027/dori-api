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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly jwtSessionRepository: JwtSessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sid) {
      throw new DoriException('UNAUTHENTICATED');
    }

    const sessionId = await this.jwtSessionRepository.findValidSessionId(
      payload.sid,
      payload.sub,
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
    };
  }
}
