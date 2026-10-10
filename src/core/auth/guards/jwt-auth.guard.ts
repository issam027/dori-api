import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DoriException } from '../../errors/dori.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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

  handleRequest(err: any, user: any, info: any) {
    // Erreur technique (DB saturée, timeout...) : 500, pas 401.
    // Le message réel reste dans les logs Vercel, pas dans la réponse.
    if (err) {
      console.error('AUTH ERROR', err?.message);
      throw new DoriException('INTERNAL_ERROR');
    }

    // Pas d'utilisateur : token absent, expiré ou invalide
    if (!user) {
      console.error(
        'AUTH FAIL',
        JSON.stringify({
          info: info?.message ?? null,
          infoName: info?.name ?? null,
        }),
      );
      throw new DoriException('UNAUTHENTICATED');
    }

    return user;
  }
}