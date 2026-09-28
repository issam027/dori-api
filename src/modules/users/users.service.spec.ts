import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';

describe('UsersService — RBAC Anti-Escalation & Role Profiles', () => {
  let service: UsersService;
  let dataSourceMock: { query: jest.Mock };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: ScopeService,
          useValue: {
            getUserScope: jest.fn(),
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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should prevent an operator/user with user_manage_hostess from updating a manager (higher profile)', async () => {
    const caller: AuthenticatedUser = {
      userId: 10,
      username: 'manager_or_supervisor',
      roles: ['manager'],
      permissions: ['user_manage_hostess', 'user_manage_kiosk'],
      userType: 'human',
    };

    // When checking caller max rank: manager rank 3
    // When checking caller permissions: only user_manage_hostess -> maxManageRank = 2
    // Target user (userId 20) is manager: rank 3
    dataSourceMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 10) {
        return [{ max_rank: 3 }];
      }
      if (sql.includes('SELECT DISTINCT p.permission_name') && params?.[0] === 10) {
        return [{ permission_name: 'user_manage_hostess' }, { permission_name: 'user_manage_kiosk' }];
      }
      if (sql.includes('SELECT user_id, user_type FROM dori_user WHERE user_id = $1') && params?.[0] === 20) {
        return [{ user_id: 20, user_type: 'human' }];
      }
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 20) {
        return [{ max_rank: 3 }]; // target is rank 3 (manager)
      }
      return [];
    });

    await expect(
      service.updateUser(20, { email: 'new@dori.local' }, caller),
    ).rejects.toThrow(DoriException);

    try {
      await service.updateUser(20, { email: 'new@dori.local' }, caller);
    } catch (e: any) {
      expect(['FORBIDDEN_PERMISSION', 'FORBIDDEN_ROLE_ESCALATION']).toContain(e.code);
    }
  });

  it('should allow a manager (rank 3, user_manage_hostess) to update an hostess (rank 2)', async () => {
    const caller: AuthenticatedUser = {
      userId: 10,
      username: 'manager1',
      roles: ['manager'],
      permissions: ['user_manage_hostess', 'user_manage_kiosk'],
      userType: 'human',
    };

    dataSourceMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 10) {
        return [{ max_rank: 3 }];
      }
      if (sql.includes('SELECT DISTINCT p.permission_name') && params?.[0] === 10) {
        return [{ permission_name: 'user_manage_hostess' }, { permission_name: 'user_manage_kiosk' }];
      }
      if (sql.includes('SELECT user_id, user_type FROM dori_user WHERE user_id = $1') && params?.[0] === 25) {
        return [{ user_id: 25, user_type: 'human' }];
      }
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 25) {
        return [{ max_rank: 2 }]; // target is rank 2 (hotesse)
      }
      if (sql.includes('SELECT user_id, username, email') && params?.[0] === 25) {
        return [{ user_id: 25, username: 'hotesse1', email: 'old@dori.local' }];
      }
      if (sql.includes('UPDATE dori_user SET')) {
        return [{ user_id: 25, username: 'hotesse1', email: 'updated@dori.local' }];
      }
      return [];
    });

    const result = await service.updateUser(25, { email: 'updated@dori.local' }, caller);
    expect(result).toBeDefined();
    expect(result.email).toBe('updated@dori.local');
  });

  it('should prevent assigning a role higher than hostess when only having user_manage_hostess', async () => {
    const caller: AuthenticatedUser = {
      userId: 10,
      username: 'manager1',
      roles: ['manager'],
      permissions: ['user_manage_hostess', 'user_manage_kiosk'],
      userType: 'human',
    };

    dataSourceMock.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 10) {
        return [{ max_rank: 4 }]; // caller rank 4
      }
      if (sql.includes('SELECT DISTINCT p.permission_name') && params?.[0] === 10) {
        return [{ permission_name: 'user_manage_hostess' }];
      }
      if (sql.includes('SELECT user_id, user_type FROM dori_user WHERE user_id = $1') && params?.[0] === 30) {
        return [{ user_id: 30, user_type: 'human' }];
      }
      if (sql.includes('SELECT MAX(r.rank) as max_rank') && params?.[0] === 30) {
        return [{ max_rank: 2 }]; // target is rank 2 (hotesse)
      }
      if (sql.includes('SELECT rank FROM dori_role WHERE role_id = $1') && params?.[0] === 3) {
        return [{ rank: 3 }]; // trying to assign manager role (rank 3)
      }
      return [];
    });

    await expect(service.assignUserRole(30, 3, caller)).rejects.toThrow(DoriException);
    try {
      await service.assignUserRole(30, 3, caller);
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN_PERMISSION');
    }
  });
});
