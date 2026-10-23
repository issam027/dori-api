import { Test, TestingModule } from '@nestjs/testing';
import { SitesService } from './sites.service';
import { SitesRepository } from './sites.repository';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginationDto } from '../../core/pagination/pagination.dto';

describe('SitesService ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â direct site users', () => {
  let service: SitesService;
  let sitesRepositoryMock: {
    findUserStatus: jest.Mock;
    hasActiveDirectSiteRole: jest.Mock;
    assignDirectSiteUser: jest.Mock;
    findDirectSiteUsers: jest.Mock;
    removeDirectSiteUser: jest.Mock;
  };
  let scopeServiceMock: {
    checkSiteAccess: jest.Mock;
    invalidateUserScope: jest.Mock;
  };

  const adminUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'admin_user',
    roles: ['admin'],
    permissions: ['user_site_assign'],
    userType: 'human',
  };

  beforeEach(async () => {
    sitesRepositoryMock = {
      findUserStatus: jest.fn(),
      hasActiveDirectSiteRole: jest.fn(),
      assignDirectSiteUser: jest.fn(),
      findDirectSiteUsers: jest.fn(),
      removeDirectSiteUser: jest.fn(),
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

  it('should throw USER_NOT_FOUND when target user does not exist in dorify.dori_user', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue(null);

    await expect(
      service.assignDirectSiteUser(
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000999',
        adminUser,
      ),
    ).rejects.toThrow(
      new DoriException('USER_NOT_FOUND', {
        userId: '00000000-0000-4000-8000-000000000999',
      }),
    );
  });

  it('should throw ACCOUNT_LOCKED when target user is inactive', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: '00000000-0000-4000-8000-000000000002',
      is_active: false,
    });

    await expect(
      service.assignDirectSiteUser(
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000002',
        adminUser,
      ),
    ).rejects.toThrow(
      new DoriException('ACCOUNT_LOCKED', {
        userId: '00000000-0000-4000-8000-000000000002',
      }),
    );
  });

  it('rejects users without an admin or manager role', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: '00000000-0000-4000-8000-000000000002',
      is_active: true,
    });
    sitesRepositoryMock.hasActiveDirectSiteRole.mockResolvedValue(false);

    await expect(
      service.assignDirectSiteUser(
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000002',
        adminUser,
      ),
    ).rejects.toThrow(new DoriException('FORBIDDEN_ROLE_ESCALATION'));
  });

  it('assigns an active admin or manager directly to the site', async () => {
    sitesRepositoryMock.findUserStatus.mockResolvedValue({
      user_id: '00000000-0000-4000-8000-000000000002',
      is_active: true,
    });
    sitesRepositoryMock.hasActiveDirectSiteRole.mockResolvedValue(true);
    sitesRepositoryMock.assignDirectSiteUser.mockResolvedValue(undefined);

    const result = await service.assignDirectSiteUser(
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000002',
      adminUser,
    );
    expect(result).toEqual({
      siteId: '00000000-0000-4000-8000-000000000010',
      userId: '00000000-0000-4000-8000-000000000002',
      assigned: true,
    });
    expect(scopeServiceMock.invalidateUserScope).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
    );
  });

  describe('VAL-02 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â findDirectSiteUsers pagination', () => {
    it('returns paginated admins and managers with mapped properties', async () => {
      sitesRepositoryMock.findDirectSiteUsers.mockResolvedValue({
        total: 2,
        items: [
          {
            user_id: '00000000-0000-4000-8000-000000000002',
            username: 'mgr1',
            email: 'mgr1@example.com',
            user_type: 'human',
            is_active: true,
            assigned_at: '2026-09-29T10:00:00Z',
          },
          {
            user_id: '00000000-0000-4000-8000-000000000003',
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

      const result = await service.findDirectSiteUsers(
        '00000000-0000-4000-8000-000000000001',
        pagination,
        adminUser,
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.items).toEqual([
        {
          user_id: '00000000-0000-4000-8000-000000000002',
          username: 'mgr1',
          email: 'mgr1@example.com',
          is_active: true,
          user_type: 'human',
          assigned_at: '2026-09-29T10:00:00Z',
        },
        {
          user_id: '00000000-0000-4000-8000-000000000003',
          username: 'mgr2',
          email: 'mgr2@example.com',
          is_active: true,
          user_type: 'human',
          assigned_at: '2026-09-29T11:00:00Z',
        },
      ]);
    });

    it('returns paginated direct site users', async () => {
      sitesRepositoryMock.findDirectSiteUsers.mockResolvedValue({
        total: 1,
        items: [
          {
            user_id: '00000000-0000-4000-8000-000000000002',
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

      const res = await service.findDirectSiteUsers(
        '00000000-0000-4000-8000-000000000001',
        pagination,
        adminUser,
      );
      expect(res.page).toBe(2);
      expect(res.pageSize).toBe(5);
      expect(res.total).toBe(1);
      expect((res.items[0] as any).user_id).toBe(
        '00000000-0000-4000-8000-000000000002',
      );
    });
  });
});
