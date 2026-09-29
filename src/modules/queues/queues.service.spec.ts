import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { QueuesService } from './queues.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';

describe('QueuesService — SEC-04 assignOperator', () => {
  let service: QueuesService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: {
    checkQueueAccess: jest.Mock;
    checkSiteAccess: jest.Mock;
    invalidateUserScope: jest.Mock;
    clearAllScopeCache: jest.Mock;
  };

  const managerUser: AuthenticatedUser = {
    userId: 1,
    username: 'manager_user',
    roles: ['manager'],
    permissions: ['user_queue_assign'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    scopeServiceMock = {
      checkQueueAccess: jest.fn().mockResolvedValue(undefined),
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      invalidateUserScope: jest.fn(),
      clearAllScopeCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: ScopeService,
          useValue: scopeServiceMock,
        },
        {
          provide: ClockService,
          useValue: {
            now: jest.fn(() => new Date('2026-09-29T12:00:00Z')),
          },
        },
      ],
    }).compile();

    service = module.get<QueuesService>(QueuesService);
  });

  it('should throw USER_NOT_FOUND when target user does not exist in dori_user', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dori_site_queue_thread')) {
        return [{ site_id: 10 }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [];
      }
      return [];
    });

    await expect(service.assignOperator(5, 999, managerUser)).rejects.toThrow(
      new DoriException('USER_NOT_FOUND', { userId: 999 }),
    );
  });

  it('should throw ACCOUNT_LOCKED when target user is inactive', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dori_site_queue_thread')) {
        return [{ site_id: 10 }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: false }];
      }
      return [];
    });

    await expect(service.assignOperator(5, 2, managerUser)).rejects.toThrow(
      new DoriException('ACCOUNT_LOCKED', { userId: 2 }),
    );
  });

  it('should throw FORBIDDEN_ROLE_ESCALATION when target user does not have hotesse/operator role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dori_site_queue_thread')) {
        return [{ site_id: 10 }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: true }];
      }
      if (sql.includes('r.role_name IN (\'hotesse\', \'operator\')')) {
        return [];
      }
      return [];
    });

    await expect(service.assignOperator(5, 2, managerUser)).rejects.toThrow(
      new DoriException('FORBIDDEN_ROLE_ESCALATION'),
    );
  });

  it('should assign operator successfully when user exists, is active and has hotesse role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dori_site_queue_thread')) {
        return [{ site_id: 10 }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: true }];
      }
      if (sql.includes('r.role_name IN (\'hotesse\', \'operator\')')) {
        return [{ user_id: 2 }];
      }
      if (sql.includes('INSERT INTO dori_user_queue')) {
        return [];
      }
      return [];
    });

    const result = await service.assignOperator(5, 2, managerUser);
    expect(result).toEqual({ queueId: 5, userId: 2, assigned: true });
    expect(scopeServiceMock.invalidateUserScope).toHaveBeenCalledWith(2);
  });

  describe('deleteQueue (DAT-05)', () => {
    it('should throw QUEUE_NOT_FOUND when queue does not exist or is inactive', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM dori_site_queue_thread q')) {
          return [];
        }
        return [];
      });

      await expect(service.deleteQueue(999, managerUser)).rejects.toThrow(
        new DoriException('QUEUE_NOT_FOUND', { queueId: 999 }),
      );
    });

    it('should soft delete queue, cascade to tiers and close open sessions', async () => {
      const queries: { sql: string; params: any[] }[] = [];
      dataSourceMock.query.mockImplementation(async (sql: string, params: any[]) => {
        queries.push({ sql, params });
        if (sql.includes('FROM dori_site_queue_thread q')) {
          return [{ queue_id: 5, is_active: true }];
        }
        return [];
      });

      const result = await service.deleteQueue(5, managerUser);
      expect(result).toEqual({ queueId: 5, deleted: true });

      const queueUpdate = queries.find(
        (q) => q.sql.includes('UPDATE dori_site_queue_thread') && q.sql.includes('SET is_active = FALSE'),
      );
      expect(queueUpdate).toBeDefined();
      expect(queueUpdate?.params[2]).toBe(5);

      const tiersUpdate = queries.find(
        (q) => q.sql.includes('UPDATE dori_queue_service_tier') && q.sql.includes('SET is_active = FALSE'),
      );
      expect(tiersUpdate).toBeDefined();
      expect(tiersUpdate?.params[2]).toBe(5);

      const sessionsUpdate = queries.find(
        (q) => q.sql.includes('UPDATE dori_queue_session') && q.sql.includes('closure_reason = \'forced\''),
      );
      expect(sessionsUpdate).toBeDefined();
      expect(sessionsUpdate?.params[2]).toBe(5);
    });
  });
});

