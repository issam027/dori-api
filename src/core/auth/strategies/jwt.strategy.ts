import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  JwtPayload,
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly dataSource: DataSource,
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

    const sessions = await this.dataSource.query(
      `SELECT s.session_id
       FROM dori_user_session s
       JOIN dori_user u ON u.user_id = s.user_id
       WHERE s.session_id = $1 AND s.user_id = $2
         AND s.revoked_reason IS NULL AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [payload.sid, payload.sub],
    );

    if (!sessions || sessions.length === 0) {
      throw new DoriException('UNAUTHENTICATED');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      userType: payload.userType || 'human',
      sessionId: sessions[0].session_id,
    };
  }
}
