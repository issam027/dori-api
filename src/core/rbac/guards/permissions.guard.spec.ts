import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { DoriException } from '../../errors/dori.exception';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ userId: 1, permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow root without checking permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'permissions') return ['user_manage_admin'];
      return undefined;
    });
    const context = createMockContext({
      userId: 1,
      roles: ['root'],
      permissions: [],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow if user has at least one of the any_permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'any_permissions') {
        return ['user_manage_hostess', 'user_manage_admin'];
      }
      return undefined;
    });

    const context = createMockContext({
      userId: 2,
      permissions: ['user_manage_hostess'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject if user has none of the any_permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'any_permissions') {
        return ['user_manage_manager', 'user_manage_admin'];
      }
      return undefined;
    });

    const context = createMockContext({
      userId: 2,
      permissions: ['user_manage_hostess'],
    });

    expect(() => guard.canActivate(context)).toThrow(DoriException);
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN_PERMISSION');
    }
  });
});
