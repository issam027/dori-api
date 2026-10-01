import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SitesService } from './sites.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';

describe('SitesService — SEC-04 assignSiteManager', () => {
  let service: SitesService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: {
    checkSiteAccess: jest.Mock;
    invalidateUserScope: jest.Mock;
  };

  const adminUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin_user',
    roles: ['admin'],
    permissions: ['user_site_assign'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    scopeServiceMock = {
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      invalidateUserScope: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitesService,
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

    service = module.get<SitesService>(SitesService);
  });

  it('should throw USER_NOT_FOUND when target user does not exist in dori_user', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [];
      }
      return [];
    });

    await expect(service.assignSiteManager(10, 999, adminUser)).rejects.toThrow(
      new DoriException('USER_NOT_FOUND', { userId: 999 }),
    );
  });

  it('should throw ACCOUNT_LOCKED when target user is inactive', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: false }];
      }
      return [];
    });

    await expect(service.assignSiteManager(10, 2, adminUser)).rejects.toThrow(
      new DoriException('ACCOUNT_LOCKED', { userId: 2 }),
    );
  });

  it('should throw FORBIDDEN_ROLE_ESCALATION when target user does not have manager role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: true }];
      }
      if (sql.includes('r.role_name = \'manager\'')) {
        return [];
      }
      return [];
    });

    await expect(service.assignSiteManager(10, 2, adminUser)).rejects.toThrow(
      new DoriException('FORBIDDEN_ROLE_ESCALATION'),
    );
  });

  it('should assign site manager successfully when user exists, is active and has manager role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, is_active FROM dori_user')) {
        return [{ user_id: 2, is_active: true }];
      }
      if (sql.includes('r.role_name = \'manager\'')) {
        return [{ user_id: 2 }];
      }
      if (sql.includes('INSERT INTO dori_user_site')) {
        return [];
      }
      return [];
    });

    const result = await service.assignSiteManager(10, 2, adminUser);
    expect(result).toEqual({ siteId: 10, userId: 2, assigned: true });
    expect(scopeServiceMock.invalidateUserScope).toHaveBeenCalledWith(2);
  });
});
