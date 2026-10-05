import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { QueueEngineService } from './queue-engine.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../core/pagination/pagination.dto';

describe('QueueEngineService — getSessions & getActiveSessions (VAL-04 Manquement A)', () => {
  let service: QueueEngineService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: { checkQueueAccess: jest.Mock };

  const testUser: AuthenticatedUser = {
    userId: 1,
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
        session_id: 101,
        queue_id: 1,
        thread_number: 1,
        user_id: 2,
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

    const result = await service.getActiveSessions(1, pagination, testUser);

    expect(scopeServiceMock.checkQueueAccess).toHaveBeenCalledWith(testUser, 1);
    expect(result).toEqual({
      items: [
        {
          session_id: 101,
          queue_id: 1,
          thread_number: 1,
          user_id: 2,
          username: 'alice',
          mode: 'active',
          connected_at: new Date('2026-09-29T08:00:00Z'),
          disconnected_at: null,
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
    const result = await service.getActiveSessions(1, testUser);

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

    await service.getActiveSessions(1, pagination, testUser);

    // Ne doit pas injecter maliciousColumn mais retomber sur qs.connected_at
    expect(capturedSql).toContain('ORDER BY qs.connected_at');
    expect(capturedSql).not.toContain('maliciousColumn');
  });
});
