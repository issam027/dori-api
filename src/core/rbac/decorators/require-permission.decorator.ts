import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';

export const RequirePermission = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiExtension('x-required-permissions', { mode: 'all', permissions }),
  );

export const RequireAnyPermission = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(ANY_PERMISSIONS_KEY, permissions),
    ApiExtension('x-required-permissions', { mode: 'any', permissions }),
  );
