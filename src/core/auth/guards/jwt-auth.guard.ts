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

    const req = context.switchToHttp().getRequest();
    console.log(
      'REQ',
      req.method,
      req.url,
      'hasAuth:',
      !!req.headers['authorization'],
    );

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.error(
        'AUTH FAIL',
        JSON.stringify({
          err: err?.message ?? null,
          info: info?.message ?? null,
          infoName: info?.name ?? null,
        }),
      );
      throw new DoriException('UNAUTHENTICATED');
    }
    return user;
  }
}