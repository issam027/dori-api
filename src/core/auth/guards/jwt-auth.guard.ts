import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DoriException } from '../../errors/dori.exception';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null,
    _info: unknown,
  ): TUser {
    // Erreur technique (DB saturée, timeout...) : 500, pas 401.
    // Le message réel reste dans les logs Vercel, pas dans la réponse.
    if (err) {
      this.logger.error('Authentication infrastructure failure');
      throw new DoriException('INTERNAL_ERROR');
    }

    // Pas d'utilisateur : token absent, expiré ou invalide
    if (!user) {
      this.logger.warn('Authentication rejected');
      throw new DoriException('UNAUTHENTICATED');
    }

    return user;
  }
}
