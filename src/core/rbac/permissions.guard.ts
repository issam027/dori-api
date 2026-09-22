import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) {
      throw new AppException(ErrorCode.FORBIDDEN_PERMISSION);
    }

    // Root a accès universel (§4.9)
    if (user.roles?.includes('root')) {
      return true;
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new AppException(ErrorCode.FORBIDDEN_PERMISSION);
    }

    return true;
  }
}
