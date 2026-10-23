import { DoriException } from '../errors/dori.exception';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditEventQueryDto } from './dto/audit-query.dto';
import { ScopeService } from '../rbac/services/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('AuditService', () => {
  const repository = {
    search: jest.fn(),
    findById: jest.fn(),
  } as unknown as AuditRepository;
  const scopeService = {
    getUserScope: jest
      .fn()
      .mockResolvedValue({ isGlobal: true, siteIds: [], queueIds: [] }),
    checkSiteAccess: jest.fn(),
  } as unknown as ScopeService;
  const service = new AuditService(repository, scopeService);
  const user = {
    userId: 1,
    username: 'root',
    roles: ['root'],
    permissions: ['system_manage'],
    userType: 'human' as const,
  } satisfies AuthenticatedUser;

  beforeEach(() => jest.clearAllMocks());

  it('applies safe sorting and returns a paginated response', async () => {
    (repository.search as jest.Mock).mockResolvedValue({
      items: [{ event_id: 'event-1' }],
      total: 1,
    });
    const query = Object.assign(new AuditEventQueryDto(), {
      page: 2,
      pageSize: 10,
      sort: 'maliciousSql:asc',
    });

    const result = await service.search(query, user);

    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({
        sortField: 'occurred_at',
        sortOrder: 'ASC',
        pageSize: 10,
        offset: 10,
      }),
    );
    expect(result).toEqual({
      items: [{ event_id: 'event-1' }],
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('returns an event by id', async () => {
    (repository.findById as jest.Mock).mockResolvedValue({
      event_id: 'id-1',
      action: 'site.create',
    });
    await expect(service.findById('id-1', user)).resolves.toEqual({
      event_id: 'id-1',
      action: 'site.create',
      action_display_name: 'Création d’un site',
    });
  });

  it('rejects an unknown event', async () => {
    (repository.findById as jest.Mock).mockResolvedValue(null);
    await expect(service.findById('missing', user)).rejects.toBeInstanceOf(
      DoriException,
    );
  });

  it('restricts a non-global user to assigned sites', async () => {
    (scopeService.getUserScope as jest.Mock).mockResolvedValueOnce({
      isGlobal: false,
      siteIds: [3, 4],
      queueIds: [],
    });
    (repository.search as jest.Mock).mockResolvedValue({ items: [], total: 0 });

    await service.search(new AuditEventQueryDto(), user);

    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({ allowedSiteIds: [3, 4] }),
    );
  });
});
