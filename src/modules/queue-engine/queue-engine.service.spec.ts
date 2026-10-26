import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { QueueEngineService } from './queue-engine.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { QueueEngineRepository } from './queue-engine.repository';

describe('QueueEngineService ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â getSessions & getActiveSessions (VAL-04 Manquement A)', () => {
  let service: QueueEngineService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: { checkQueueAccess: jest.Mock };

  const testUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'operator1',
    roles: ['operator'],
    permissions: ['session_operate'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    scopeServiceMock = {
      checkQueueAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueEngineService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: QueueEngineRepository,
          useFactory: (dataSource: DataSource) =>
            new QueueEngineRepository(dataSource),
          inject: [DataSource],
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

    service = module.get<QueueEngineService>(QueueEngineService);
  });

  it('should return paginated active sessions conforming to PaginatedResult contract', async () => {
    const rawSessions = [
      {
        session_id: '00000000-0000-4000-8000-000000000101',
        queue_id: '00000000-0000-4000-8000-000000000001',
        thread_number: 1,
        counter_name: 'Guichet 04',
        user_id: '00000000-0000-4000-8000-000000000002',
        username: 'alice',
        mode: 'active',
        connected_at: new Date('2026-09-29T08:00:00Z'),
        disconnected_at: null,
      },
    ];

    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT COUNT(*)::int as total')) {
        return [{ total: 1 }];
      }
      if (sql.includes('SELECT qs.session_id')) {
        return rawSessions;
      }
      return [];
    });

    const pagination = new PaginationDto();
    pagination.page = 1;
    pagination.pageSize = 10;

    const result = await service.getActiveSessions(
      '00000000-0000-4000-8000-000000000001',
      pagination,
      testUser,
    );

    expect(scopeServiceMock.checkQueueAccess).toHaveBeenCalledWith(
      testUser,
      '00000000-0000-4000-8000-000000000001',
    );
    expect(result).toEqual({
      items: [
        {
          sessionId: '00000000-0000-4000-8000-000000000101',
          queueId: '00000000-0000-4000-8000-000000000001',
          threadNumber: 1,
          counterName: 'Guichet 04',
          userId: '00000000-0000-4000-8000-000000000002',
          username: 'alice',
          mode: 'active',
          connectedAt: new Date('2026-09-29T08:00:00Z'),
          disconnectedAt: null,
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('should support backward-compatible signature without pagination parameter', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT COUNT(*)::int as total')) {
        return [{ total: 0 }];
      }
      if (sql.includes('SELECT qs.session_id')) {
        return [];
      }
      return [];
    });

    // Appel avec l'ancienne signature (queueId, user)
    const result = await service.getActiveSessions(
      '00000000-0000-4000-8000-000000000001',
      testUser,
    );

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should secure sortField via allowlist', async () => {
    let capturedSql = '';
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT qs.session_id')) {
        capturedSql = sql;
        return [];
      }
      return [{ total: 0 }];
    });

    const pagination = new PaginationDto();
    pagination.sort = 'maliciousColumn:asc';

    await service.getActiveSessions(
      '00000000-0000-4000-8000-000000000001',
      pagination,
      testUser,
    );

    // Ne doit pas injecter maliciousColumn mais retomber sur qs.connected_at
    expect(capturedSql).toContain('ORDER BY qs.connected_at');
    expect(capturedSql).not.toContain('maliciousColumn');
  });
});

describe('QueueEngineService next preview scope', () => {
  it('keeps only site queues that belong to the user scope', async () => {
    const user: AuthenticatedUser = {
      userId: '00000000-0000-4000-8000-000000000008',
      username: 'operator',
      roles: ['operator'],
      permissions: ['queue_view'],
      userType: 'human',
    };
    const repository = {
      findQueueIds: jest
        .fn()
        .mockResolvedValue([
          '00000000-0000-4000-8000-000000000010',
          '00000000-0000-4000-8000-000000000011',
          '00000000-0000-4000-8000-000000000012',
        ]),
      findActiveQueueIdsForUser: jest
        .fn()
        .mockResolvedValue(['00000000-0000-4000-8000-000000000011']),
      findPreviewCandidates: jest.fn().mockResolvedValue([]),
    };
    const scope = {
      getUserScope: jest.fn().mockResolvedValue({
        isGlobal: false,
        siteIds: ['00000000-0000-4000-8000-000000000005'],
        queueIds: [
          '00000000-0000-4000-8000-000000000011',
          '00000000-0000-4000-8000-000000000099',
        ],
      }),
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
    };
    const now = new Date('2026-10-17T10:00:00Z');
    const service = new QueueEngineService(
      repository as unknown as QueueEngineRepository,
      scope as unknown as ScopeService,
      { now: jest.fn(() => now) } as unknown as ClockService,
    );

    await service.previewNext(user, '00000000-0000-4000-8000-000000000005', 10);

    expect(scope.checkSiteAccess).toHaveBeenCalledWith(
      user,
      '00000000-0000-4000-8000-000000000005',
    );
    expect(repository.findActiveQueueIdsForUser).toHaveBeenCalledWith(
      ['00000000-0000-4000-8000-000000000011'],
      user.userId,
    );
    expect(repository.findPreviewCandidates).toHaveBeenCalledWith(
      ['00000000-0000-4000-8000-000000000011'],
      now,
      10,
    );
  });
});
