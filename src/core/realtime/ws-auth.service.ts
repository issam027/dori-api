import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../auth/interfaces/jwt-payload.interface';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly jwtStrategy: JwtStrategy,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const algorithm = this.configService.get<'HS256' | 'RS256'>(
      'jwt.algorithm',
    );
    const secret =
      algorithm === 'RS256'
        ? this.configService.getOrThrow<string>('jwt.publicKey')
        : this.configService.getOrThrow<string>('jwt.secret');
    const payload = this.jwtService.verify<JwtPayload>(token, {
      secret,
      algorithms: [algorithm ?? 'HS256'],
    });
    return this.jwtStrategy.validate(payload);
  }
}
