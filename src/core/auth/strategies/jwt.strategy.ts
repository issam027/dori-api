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
    // Vérifier qu'il existe au moins une session active (non révoquée) pour cet utilisateur
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

    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      userType: payload.userType || 'human',
    };
  }
}
