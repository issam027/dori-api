import { Test, TestingModule } from '@nestjs/testing';
import { SitesService } from './sites.service';
import { SitesRepository } from './sites.repository';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginationDto } from '../../core/pagination/pagination.dto';

describe('SitesService — SEC-04 assignSiteManager', () => {
  let service: SitesService;
  let sitesRepositoryMock: {
    findUserStatus: jest.Mock;
    hasActiveManagerRole: jest.Mock;
    assignManager: jest.Mock;
    findManagers: jest.Mock;
  };
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
    sitesRepositoryMock = {
      findUserStatus: jest.fn(),
      hasActiveManagerRole: jest.fn(),
      assignManager: jest.fn(),
      findManagers: jest.fn(),
    };

    scopeServiceMock = {
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      invalidateUserScope: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitesService,
        {
          provide: SitesRepository,
          useValue: sitesRepositoryMock,
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
    sitesRepositoryMock.findUserStatus.mockResolvedValue(null);

    await expect(service.assignSiteManager(10, 999, adminUser)).rejects.toThrow(
      new DoriException('USER_NOT_FOUND', { userId: 999 }),
    );
  });

  it('should throw ACCOUNT_LOCKED when target user is inactive', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: 2,
      is_active: false,
    });

    await expect(service.assignSiteManager(10, 2, adminUser)).rejects.toThrow(
      new DoriException('ACCOUNT_LOCKED', { userId: 2 }),
    );
  });

  it('should throw FORBIDDEN_ROLE_ESCALATION when target user does not have manager role', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: 2,
      is_active: true,
    });
    sitesRepositoryMock.hasActiveManagerRole.mockResolvedValue(false);

    await expect(service.assignSiteManager(10, 2, adminUser)).rejects.toThrow(
      new DoriException('FORBIDDEN_ROLE_ESCALATION'),
    );
  });

  it('should assign site manager successfully when user exists, is active and has manager role', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: 2,
      is_active: true,
    });
    sitesRepositoryMock.hasActiveManagerRole.mockResolvedValue(true);
    sitesRepositoryMock.assignManager.mockResolvedValue(undefined);

    const result = await service.assignSiteManager(10, 2, adminUser);
    expect(result).toEqual({ siteId: 10, userId: 2, assigned: true });
    expect(scopeServiceMock.invalidateUserScope).toHaveBeenCalledWith(2);
  });

  describe('VAL-02 — findSiteManagers and getSiteManagers pagination', () => {
    it('should return paginated managers with correctly mapped properties', async () => {
      sitesRepositoryMock.findManagers.mockResolvedValue({
        total: 2,
        items: [
          {
            user_id: 2,
            username: 'mgr1',
            email: 'mgr1@example.com',
            user_type: 'human',
            is_active: true,
            assigned_at: '2026-09-29T10:00:00Z',
          },
          {
            user_id: 3,
            username: 'mgr2',
            email: 'mgr2@example.com',
            user_type: 'human',
            is_active: true,
            assigned_at: '2026-09-29T11:00:00Z',
          },
        ],
      });

      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 10;

      const result = await service.findSiteManagers(1, pagination, adminUser);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.items).toEqual([
        {
          user_id: 2,
          username: 'mgr1',
          email: 'mgr1@example.com',
          is_active: true,
          user_type: 'human',
          assigned_at: '2026-09-29T10:00:00Z',
        },
        {
          user_id: 3,
          username: 'mgr2',
          email: 'mgr2@example.com',
          is_active: true,
          user_type: 'human',
          assigned_at: '2026-09-29T11:00:00Z',
        },
      ]);
    });

    it('getSiteManagers should delegate to findSiteManagers with pagination support', async () => {
      sitesRepositoryMock.findManagers.mockResolvedValue({
        total: 1,
        items: [
          {
            user_id: 2,
            username: 'mgr1',
            email: 'mgr1@example.com',
            user_type: 'human',
            is_active: true,
            assigned_at: '2026-09-29T10:00:00Z',
          },
        ],
      });

      const pagination = new PaginationDto();
      pagination.page = 2;
      pagination.pageSize = 5;

      const res = await service.getSiteManagers(1, pagination, adminUser);
      expect(res.page).toBe(2);
      expect(res.pageSize).toBe(5);
      expect(res.total).toBe(1);
      expect((res.items[0] as any).user_id).toBe(2);
    });
  });
});
