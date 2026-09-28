import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest() as {
      user?: AuthenticatedUser;
    };

    if (!user) {
      throw new DoriException('UNAUTHENTICATED');
    }

    // Root role has all permissions implicitly
    if (user.roles?.includes('root')) {
      return true;
    }

    const userPermissions = new Set(user.permissions || []);
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.has(perm),
    );

    if (!hasAll) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }

    return true;
  }
}
