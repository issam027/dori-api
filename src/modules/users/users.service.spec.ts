import { RankService } from '../../core/rbac/services/rank.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { UsersRepository } from './users.repository';

describe('UsersService ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â RBAC Anti-Escalation & Role Profiles', () => {
  let service: UsersService;
  let dataSourceMock: { query: jest.Mock; transaction: jest.Mock };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
      transaction: jest.fn(async (callback) =>
        callback({ query: dataSourceMock.query }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankService,
        UsersService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: ScopeService,
          useValue: {
            getUserScope: jest.fn().mockResolvedValue({
              isGlobal: true,
              siteIds: ['00000000-0000-4000-8000-000000000001'],
              queueIds: ['00000000-0000-4000-8000-000000000001'],
            }),
            checkUserAccess: jest.fn().mockResolvedValue(undefined),
            invalidateUserScope: jest.fn(),
            clearAllScopeCache: jest.fn(),
          },
        },
        {
          provide: ClockService,
          useValue: {
            now: jest.fn(() => new Date('2026-09-28T12:00:00Z')),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'security.bcryptRounds') return 12;
              return undefined;
            }),
          },
        },
        {
          provide: UsersRepository,
          useFactory: (dataSource: DataSource) =>
            new UsersRepository(dataSource),
          inject: [DataSource],
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('generates and persists a one-time temporary password when none is supplied', async () => {
    const targetUserId = '00000000-0000-4000-8000-000000000020';
    const caller: AuthenticatedUser = {
      userId: '00000000-0000-4000-8000-000000000001',
      username: 'root',
      roles: ['root'],
      permissions: [],
      userType: 'human',
    };

    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, username, email')) {
        return [
          {
            user_id: targetUserId,
            username: 'operator1',
            email: 'operator@dori.local',
            roles: [],
            sites: [],
            queues: [],
          },
        ];
      }
      return [];
    });

    const result = await service.setUserPassword(targetUserId, {}, caller);

    expect(result.temporaryPassword).toMatch(/^D![A-Za-z0-9_-]{12}a1$/);
    expect(result.temporaryPassword).toHaveLength(16);
    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE dorify.dori_user'),
      expect.arrayContaining([targetUserId]),
    );
  });

  it('should prevent an operator/user with user_manage_operator from updating a manager (higher profile)', async () => {
    const caller: AuthenticatedUser = {
      userId: '00000000-0000-4000-8000-000000000010',
      username: 'manager_or_supervisor',
      roles: ['manager'],
      permissions: ['user_manage_operator', 'user_manage_kiosk'],
      userType: 'human',
    };

    // When checking caller max rank: manager rank 3
    // When checking caller permissions: only user_manage_operator -> maxManageRank = 2
    // Target user (userId 20) is manager: rank 3
    dataSourceMock.query.mockImplementation(
      async (sql: string, params?: any[]) => {
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [{ max_rank: 3 }];
        }
        if (
          sql.includes('SELECT DISTINCT p.permission_name') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [
            { permission_name: 'user_manage_operator' },
            { permission_name: 'user_manage_kiosk' },
          ];
        }
        if (
          sql.includes(
            'SELECT user_id, user_type FROM dorify.dori_user WHERE user_id = $1',
          ) &&
          params?.[0] === '00000000-0000-4000-8000-000000000020'
        ) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000020',
              user_type: 'human',
            },
          ];
        }
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000020'
        ) {
          return [{ max_rank: 3 }]; // target is rank 3 (manager)
        }
        return [];
      },
    );

    await expect(
      service.updateUser(
        '00000000-0000-4000-8000-000000000020',
        { email: 'new@dori.local' },
        caller,
      ),
    ).rejects.toThrow(DoriException);

    try {
      await service.updateUser(
        '00000000-0000-4000-8000-000000000020',
        { email: 'new@dori.local' },
        caller,
      );
    } catch (e: any) {
      expect(['FORBIDDEN_PERMISSION', 'FORBIDDEN_ROLE_ESCALATION']).toContain(
        e.code,
      );
    }
  });

  it('should allow a manager (rank 3, user_manage_operator) to update an operator (rank 2)', async () => {
    const caller: AuthenticatedUser = {
      userId: '00000000-0000-4000-8000-000000000010',
      username: 'manager1',
      roles: ['manager'],
      permissions: ['user_manage_operator', 'user_manage_kiosk'],
      userType: 'human',
    };

    dataSourceMock.query.mockImplementation(
      async (sql: string, params?: any[]) => {
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [{ max_rank: 3 }];
        }
        if (
          sql.includes('SELECT DISTINCT p.permission_name') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [
            { permission_name: 'user_manage_operator' },
            { permission_name: 'user_manage_kiosk' },
          ];
        }
        if (
          sql.includes(
            'SELECT user_id, user_type FROM dorify.dori_user WHERE user_id = $1',
          ) &&
          params?.[0] === '00000000-0000-4000-8000-000000000025'
        ) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000025',
              user_type: 'human',
            },
          ];
        }
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000025'
        ) {
          return [{ max_rank: 2 }]; // target is rank 2 (operator)
        }
        if (
          sql.includes('SELECT user_id, username, email') &&
          params?.[0] === '00000000-0000-4000-8000-000000000025'
        ) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000025',
              username: 'operator1',
              email: 'old@dori.local',
            },
          ];
        }
        if (sql.includes('UPDATE dorify.dori_user SET')) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000025',
              username: 'operator1',
              email: 'updated@dori.local',
            },
          ];
        }
        return [];
      },
    );

    const result = await service.updateUser(
      '00000000-0000-4000-8000-000000000025',
      { email: 'updated@dori.local' },
      caller,
    );
    expect(result).toBeDefined();
    expect(result.email).toBe('updated@dori.local');
  });

  it('should prevent assigning a role higher than operator when only having user_manage_operator', async () => {
    const caller: AuthenticatedUser = {
      userId: '00000000-0000-4000-8000-000000000010',
      username: 'manager1',
      roles: ['manager'],
      permissions: ['user_manage_operator', 'user_manage_kiosk'],
      userType: 'human',
    };

    dataSourceMock.query.mockImplementation(
      async (sql: string, params?: any[]) => {
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [{ max_rank: 4 }]; // caller rank 4
        }
        if (
          sql.includes('SELECT DISTINCT p.permission_name') &&
          params?.[0] === '00000000-0000-4000-8000-000000000010'
        ) {
          return [{ permission_name: 'user_manage_operator' }];
        }
        if (
          sql.includes(
            'SELECT user_id, user_type FROM dorify.dori_user WHERE user_id = $1',
          ) &&
          params?.[0] === '00000000-0000-4000-8000-000000000030'
        ) {
          return [
            {
              user_id: '00000000-0000-4000-8000-000000000030',
              user_type: 'human',
            },
          ];
        }
        if (
          sql.includes('SELECT MAX(r.rank) as max_rank') &&
          params?.[0] === '00000000-0000-4000-8000-000000000030'
        ) {
          return [{ max_rank: 2 }]; // target is rank 2 (operator)
        }
        if (
          sql.includes(
            'SELECT rank FROM dorify.dori_role WHERE role_id = $1',
          ) &&
          params?.[0] === '00000000-0000-4000-8000-000000000003'
        ) {
          return [{ rank: 3 }]; // trying to assign manager role (rank 3)
        }
        return [];
      },
    );

    await expect(
      service.assignUserRole(
        '00000000-0000-4000-8000-000000000030',
        '00000000-0000-4000-8000-000000000003',
        caller,
      ),
    ).rejects.toThrow(DoriException);
    try {
      await service.assignUserRole(
        '00000000-0000-4000-8000-000000000030',
        '00000000-0000-4000-8000-000000000003',
        caller,
      );
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN_PERMISSION');
    }
  });

  describe('deleteUser (DAT-05)', () => {
    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      const rootCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000001',
        username: 'root_user',
        roles: ['root'],
        permissions: ['system_manage'],
        userType: 'human',
      };

      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM dorify.dori_user WHERE user_id = $1')) {
          return [];
        }
        return [];
      });

      await expect(
        service.deleteUser('00000000-0000-4000-8000-000000000999', rootCaller),
      ).rejects.toThrow(
        new DoriException('USER_NOT_FOUND', {
          userId: '00000000-0000-4000-8000-000000000999',
        }),
      );
    });

    it('should soft delete user and revoke all active sessions', async () => {
      const rootCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000001',
        username: 'root_user',
        roles: ['root'],
        permissions: ['system_manage'],
        userType: 'human',
      };

      const queries: { sql: string; params: any[] }[] = [];
      dataSourceMock.query.mockImplementation(
        async (sql: string, params: any[]) => {
          queries.push({ sql, params });
          if (sql.includes('FROM dorify.dori_user WHERE user_id = $1')) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000025',
                username: 'operator1',
                is_active: true,
              },
            ];
          }
          return [];
        },
      );

      const result = await service.deleteUser(
        '00000000-0000-4000-8000-000000000025',
        rootCaller,
      );
      expect(result).toEqual({
        userId: '00000000-0000-4000-8000-000000000025',
        deleted: true,
      });

      const userUpdate = queries.find(
        (q) =>
          q.sql.includes('UPDATE dorify.dori_user') &&
          q.sql.includes('SET is_active = FALSE'),
      );
      expect(userUpdate).toBeDefined();
      expect(userUpdate?.params[2]).toBe(
        '00000000-0000-4000-8000-000000000025',
      );

      const sessionUpdate = queries.find(
        (q) =>
          q.sql.includes('UPDATE dorify.dori_user_session') &&
          q.sql.includes('account_deleted'),
      );
      expect(sessionUpdate).toBeDefined();
      expect(sessionUpdate?.params[1]).toBe(
        '00000000-0000-4000-8000-000000000025',
      );
    });
  });

  describe('BUG1 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â HiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rarchie RBAC & Listing total par site', () => {
    it('should forbid an operator from modifying any user (even self)', async () => {
      const operatorCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000025',
        username: 'operator1',
        roles: ['operator'],
        permissions: ['session_operate'],
        userType: 'human',
      };

      dataSourceMock.query.mockImplementation(
        async (sql: string, params?: any[]) => {
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000025'
          ) {
            return [{ max_rank: 2 }];
          }
          return [];
        },
      );

      await expect(
        service.updateUser(
          '00000000-0000-4000-8000-000000000025',
          { email: 'new@dori.local' },
          operatorCaller,
        ),
      ).rejects.toThrow(new DoriException('FORBIDDEN_PERMISSION'));
    });

    it('should allow a manager to modify their own user', async () => {
      const managerCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000010',
        username: 'manager1',
        roles: ['manager'],
        permissions: ['user_manage_operator'],
        userType: 'human',
      };

      dataSourceMock.query.mockImplementation(
        async (sql: string, params?: any[]) => {
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000010'
          ) {
            return [{ max_rank: 3 }];
          }
          if (
            sql.includes('SELECT user_id, username, email') &&
            params?.[0] === '00000000-0000-4000-8000-000000000010'
          ) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000010',
                username: 'manager1',
                email: 'old@dori.local',
              },
            ];
          }
          if (sql.includes('UPDATE dorify.dori_user SET')) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000010',
                username: 'manager1',
                email: 'manager-new@dori.local',
              },
            ];
          }
          return [];
        },
      );

      const result = await service.updateUser(
        '00000000-0000-4000-8000-000000000010',
        { email: 'manager-new@dori.local' },
        managerCaller,
      );
      expect(result).toBeDefined();
      expect(result.email).toBe('manager-new@dori.local');
    });

    it('should allow an admin to modify a manager (rank 3)', async () => {
      const adminCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000005',
        username: 'admin1',
        roles: ['admin'],
        permissions: ['user_manage_admin', 'user_manage_manager'],
        userType: 'human',
      };

      dataSourceMock.query.mockImplementation(
        async (sql: string, params?: any[]) => {
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000005'
          ) {
            return [{ max_rank: 4 }]; // admin
          }
          if (
            sql.includes(
              'SELECT user_id, user_type FROM dorify.dori_user WHERE user_id = $1',
            ) &&
            params?.[0] === '00000000-0000-4000-8000-000000000010'
          ) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000010',
                user_type: 'human',
              },
            ];
          }
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000010'
          ) {
            return [{ max_rank: 3 }]; // target is manager
          }
          if (
            sql.includes('SELECT user_id, username, email') &&
            params?.[0] === '00000000-0000-4000-8000-000000000010'
          ) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000010',
                username: 'manager1',
                email: 'old@dori.local',
              },
            ];
          }
          if (sql.includes('UPDATE dorify.dori_user SET')) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000010',
                username: 'manager1',
                email: 'admin-updated@dori.local',
              },
            ];
          }
          return [];
        },
      );

      const result = await service.updateUser(
        '00000000-0000-4000-8000-000000000010',
        { email: 'admin-updated@dori.local' },
        adminCaller,
      );
      expect(result).toBeDefined();
      expect(result.email).toBe('admin-updated@dori.local');
    });

    it('should forbid an admin from modifying another admin', async () => {
      const adminCaller: AuthenticatedUser = {
        userId: '00000000-0000-4000-8000-000000000005',
        username: 'admin1',
        roles: ['admin'],
        permissions: ['user_manage_admin'],
        userType: 'human',
      };

      dataSourceMock.query.mockImplementation(
        async (sql: string, params?: any[]) => {
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000005'
          ) {
            return [{ max_rank: 4 }]; // caller admin
          }
          if (
            sql.includes(
              'SELECT user_id, user_type FROM dorify.dori_user WHERE user_id = $1',
            ) &&
            params?.[0] === '00000000-0000-4000-8000-000000000006'
          ) {
            return [
              {
                user_id: '00000000-0000-4000-8000-000000000006',
                user_type: 'human',
              },
            ];
          }
          if (
            sql.includes('SELECT MAX(r.rank) as max_rank') &&
            params?.[0] === '00000000-0000-4000-8000-000000000006'
          ) {
            return [{ max_rank: 4 }]; // target also admin
          }
          return [];
        },
      );

      await expect(
        service.updateUser(
          '00000000-0000-4000-8000-000000000006',
          { email: 'other-admin@dori.local' },
          adminCaller,
        ),
      ).rejects.toThrow(DoriException);
    });
  });
});
