import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PersonsService } from './persons.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginationDto } from '../../core/pagination/pagination.dto';

describe('PersonsService — DAT-05 deletePerson', () => {
  let service: PersonsService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: {
    getUserScope: jest.Mock;
    checkSiteAccess: jest.Mock;
  };

  const adminUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin_user',
    roles: ['admin'],
    permissions: ['customer_delete', 'customer_view'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    scopeServiceMock = {
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      getUserScope: jest.fn().mockResolvedValue({
        isGlobal: true,
        siteIds: [],
        queueIds: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
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

    service = module.get<PersonsService>(PersonsService);
  });

  describe('PERSON-001 — site-scoped identity', () => {
    it('deduplicates a phone number only inside the requested site', async () => {
      dataSourceMock.query.mockResolvedValueOnce([
        { person_id: 10, site_id: 2, phone_number: '+21698765432' },
      ]);

      const result = await service.createPerson(
        { phoneNumber: '+21698765432' },
        2,
        adminUser,
      );

      expect(scopeServiceMock.checkSiteAccess).toHaveBeenCalledWith(
        adminUser,
        2,
      );
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('site_id = $1 AND phone_number = $2'),
        [2, '+21698765432'],
      );
      expect(result.person_id).toBe(10);
    });

    it('creates another person when the same phone exists only in another site', async () => {
      dataSourceMock.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ person_id: 20, site_id: 2 }]);

      const result = await service.createPerson(
        { firstName: 'Amine', phoneNumber: '+21698765432' },
        2,
        adminUser,
      );

      const insert = dataSourceMock.query.mock.calls[1];
      expect(insert[0]).toContain('site_id, first_name');
      expect(insert[1][0]).toBe(2);
      expect(result).toEqual({ person_id: 20, site_id: 2 });
    });

    it('does not expose a person whose site is outside the user scope', async () => {
      scopeServiceMock.getUserScope.mockResolvedValue({
        isGlobal: false,
        siteIds: [1],
        queueIds: [10],
      });
      dataSourceMock.query.mockResolvedValue([]);

      await expect(service.findPersonById(42, adminUser)).rejects.toThrow(
        new DoriException('PERSON_NOT_FOUND', { personId: 42 }),
      );
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('site_id = ANY($2)'),
        [42, [1]],
      );
    });
  });

  it('should throw PERSON_NOT_FOUND when person does not exist or is inactive', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM dori_person WHERE person_id = $1')) {
        return [];
      }
      return [];
    });

    await expect(service.deletePerson(999, adminUser)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', { personId: 999 }),
    );
  });

  it('should soft delete person and cascade deactivation to person notes', async () => {
    const queries: { sql: string; params: any[] }[] = [];
    dataSourceMock.query.mockImplementation(
      async (sql: string, params: any[]) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT * FROM dori_person WHERE person_id = $1')) {
          return [{ person_id: 42, is_active: true }];
        }
        return [];
      },
    );

    const result = await service.deletePerson(42, adminUser);
    expect(result).toEqual({ id: 42, deleted: true });

    // Vérification soft-delete sur dori_person
    const personUpdate = queries.find(
      (q) =>
        q.sql.includes('UPDATE dori_person') &&
        q.sql.includes('SET is_active = FALSE'),
    );
    expect(personUpdate).toBeDefined();
    expect(personUpdate?.params[2]).toBe(42);

    // Vérification cascade sur dori_person_note
    const notesUpdate = queries.find(
      (q) =>
        q.sql.includes('UPDATE dori_person_note') &&
        q.sql.includes('SET is_active = FALSE'),
    );
    expect(notesUpdate).toBeDefined();
    expect(notesUpdate?.params[2]).toBe(42);
  });

  describe('VAL-02 — findPersonNotes and getNotes pagination', () => {
    it('should return paginated notes with mapped properties and author username', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM dori_person WHERE person_id = $1')) {
          return [{ person_id: 10, is_active: true }];
        }
        if (sql.includes('COUNT(*)')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM dori_person_note')) {
          return [
            {
              note_id: 1,
              person_id: 10,
              content: 'Patient VIP',
              created_by_user_id: 2,
              author_username: 'doctor1',
              created_at: '2026-09-29T10:00:00Z',
              updated_at: '2026-09-29T10:00:00Z',
            },
          ];
        }
        return [];
      });

      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 10;

      const result = await service.findPersonNotes(10, pagination, adminUser);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual({
        note_id: 1,
        person_id: 10,
        content: 'Patient VIP',
        created_by_user_id: 2,
        author_username: 'doctor1',
        created_at: '2026-09-29T10:00:00Z',
        updated_at: '2026-09-29T10:00:00Z',
      });
    });

    it('getNotes should delegate to findPersonNotes with pagination', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM dori_person WHERE person_id = $1')) {
          return [{ person_id: 10, is_active: true }];
        }
        if (sql.includes('COUNT(*)')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM dori_person_note')) {
          return [
            {
              note_id: 1,
              person_id: 10,
              content: 'Note 1',
              created_by_user_id: 2,
              author_username: 'agent1',
              created_at: '2026-09-29T10:00:00Z',
              updated_at: '2026-09-29T10:00:00Z',
            },
          ];
        }
        return [];
      });

      const pagination = new PaginationDto();
      pagination.page = 3;
      pagination.pageSize = 2;

      const res = await service.getNotes(10, pagination, adminUser);
      expect(res.page).toBe(3);
      expect(res.pageSize).toBe(2);
      expect(res.total).toBe(1);
      expect((res.items[0] as any).note_id).toBe(1);
    });
  });
});
