import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RankService } from '../../core/rbac/services/rank.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

describe('User role authorization', () => {
  const caller: AuthenticatedUser = {
    userId: 'manager',
    username: 'manager',
    roles: ['manager'],
    permissions: ['user_manage_operator'],
    userType: 'human',
  };

  function setup() {
    const repository = {
      getCallerMaxRank: jest.fn().mockResolvedValue(3),
      getUserPermissionNames: jest
        .fn()
        .mockResolvedValue(['user_manage_operator']),
      getUserMaxRank: jest.fn().mockResolvedValue({ exists: true, maxRank: 2 }),
      getRoleRank: jest.fn().mockResolvedValue(2),
      assignUserRole: jest.fn().mockResolvedValue({
        userExists: true,
        roleExists: true,
        assigned: true,
      }),
      removeUserRole: jest.fn().mockResolvedValue(true),
    };
    const scope = {
      checkUserAccess: jest.fn().mockResolvedValue(undefined),
      invalidateUserScope: jest.fn(),
    };
    const service = new UsersService(
      repository as never,
      scope as never,
      { now: () => new Date('2026-10-30T12:00:00Z') } as ClockService,
      {} as ConfigService,
      new RankService(),
    );
    return { service, repository, scope };
  }

  it.each([
    ['manager', 3, 4],
    ['manager', 3, 5],
    ['admin', 4, 5],
  ])(
    'rejects self-attribution by %s of a higher role',
    async (role, rank, requestedRank) => {
      const { service, repository } = setup();
      repository.getCallerMaxRank.mockResolvedValue(rank);
      repository.getRoleRank.mockResolvedValue(requestedRank);
      await expect(
        service.assignUserRole(caller.userId, 'higher-role', {
          ...caller,
          roles: [role],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE_ESCALATION' });
      expect(repository.assignUserRole).not.toHaveBeenCalled();
    },
  );

  it.each(['assignUserRole', 'removeUserRole'] as const)(
    'rejects %s outside the caller site before mutation',
    async (method) => {
      const { service, repository, scope } = setup();
      scope.checkUserAccess.mockRejectedValue(
        new DoriException('USER_NOT_FOUND'),
      );
      await expect(
        service[method]('foreign-operator', 'operator-role', caller),
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
      expect(scope.checkUserAccess).toHaveBeenCalledWith(
        caller,
        'foreign-operator',
      );
      expect(repository[method]).not.toHaveBeenCalled();
    },
  );

  it.each(['assignUserRole', 'removeUserRole'] as const)(
    'allows %s within the authorized site and rank',
    async (method) => {
      const { service, repository, scope } = setup();
      await service[method]('local-operator', 'operator-role', caller);
      expect(repository[method]).toHaveBeenCalled();
      expect(scope.invalidateUserScope).toHaveBeenCalledWith('local-operator');
    },
  );

  it('preserves global root administration', async () => {
    const { service, repository, scope } = setup();
    await service.assignUserRole('another-admin', 'admin-role', {
      ...caller,
      roles: ['root'],
    });
    expect(repository.getRoleRank).not.toHaveBeenCalled();
    expect(scope.checkUserAccess).toHaveBeenCalled();
    expect(repository.assignUserRole).toHaveBeenCalled();
  });
});
