import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';
import { UserContext } from '../rbac/scope.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_jwt_key_dori_v3_change_in_production_min32chars',
    });
  }

  async validate(payload: JwtPayload): Promise<UserContext> {
    return {
      userId: payload.sub,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      userType: payload.userType || 'human',
    };
  }
}
