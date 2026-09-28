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
      secretOrKey:
        configService.get<string>('jwt.secret') || 'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    let sessionId: string | undefined;

    if (payload.sid) {
      // SEC-02 : vérifier la session SPECIFIQUE liée à ce JWT
      const sessions = await this.dataSource.query(
        `SELECT session_id FROM dori_user_session
         WHERE session_id = $1 AND revoked_reason IS NULL AND revoked_at IS NULL
           AND expires_at > NOW()`,
        [payload.sid],
      );

      if (!sessions || sessions.length === 0) {
        throw new DoriException('UNAUTHENTICATED');
      }
      sessionId = sessions[0].session_id;
    } else {
      // Fallback pour les tokens émis avant le correctif SEC-02 (sans sid)
      const sessions = await this.dataSource.query(
        `SELECT session_id FROM dori_user_session
         WHERE user_id = $1 AND revoked_reason IS NULL AND revoked_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [payload.sub],
      );

      if (!sessions || sessions.length === 0) {
        throw new DoriException('UNAUTHENTICATED');
      }
      sessionId = sessions[0].session_id;
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
