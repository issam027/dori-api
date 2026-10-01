import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PersonsService } from './persons.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';

describe('PersonsService — DAT-05 deletePerson', () => {
  let service: PersonsService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: {
    getUserScope: jest.Mock;
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
    dataSourceMock.query.mockImplementation(async (sql: string, params: any[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT * FROM dori_person WHERE person_id = $1')) {
        return [{ person_id: 42, is_active: true }];
      }
      return [];
    });

    const result = await service.deletePerson(42, adminUser);
    expect(result).toEqual({ id: 42, deleted: true });

    // Vérification soft-delete sur dori_person
    const personUpdate = queries.find((q) =>
      q.sql.includes('UPDATE dori_person') && q.sql.includes('SET is_active = FALSE'),
    );
    expect(personUpdate).toBeDefined();
    expect(personUpdate?.params[2]).toBe(42);

    // Vérification cascade sur dori_person_note
    const notesUpdate = queries.find((q) =>
      q.sql.includes('UPDATE dori_person_note') && q.sql.includes('SET is_active = FALSE'),
    );
    expect(notesUpdate).toBeDefined();
    expect(notesUpdate?.params[2]).toBe(42);
  });
});
