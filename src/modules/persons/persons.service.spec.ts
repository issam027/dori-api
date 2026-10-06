import { Test } from '@nestjs/testing';
import { PersonsService } from './persons.service';
import { PersonsRepository } from './persons.repository';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginationDto } from '../../core/pagination/pagination.dto';

describe('PersonsService', () => {
  let service: PersonsService;
  let repository: Record<string, jest.Mock>;
  let scope: { getUserScope: jest.Mock; checkSiteAccess: jest.Mock };
  const user: AuthenticatedUser = {
    userId: 1,
    username: 'admin',
    roles: ['admin'],
    permissions: ['customer_delete', 'customer_view'],
    userType: 'human',
  };

  beforeEach(async () => {
    repository = {
      existsInSites: jest.fn(),
      findPersons: jest.fn(),
      findActiveById: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findNotes: jest.fn(),
      createNote: jest.fn(),
      updateNote: jest.fn(),
      deleteNote: jest.fn(),
      softDeleteWithNotes: jest.fn(),
    };
    scope = {
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      getUserScope: jest.fn().mockResolvedValue({
        isGlobal: true,
        siteIds: [],
        queueIds: [],
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PersonsService,
        { provide: PersonsRepository, useValue: repository },
        { provide: ScopeService, useValue: scope },
        {
          provide: ClockService,
          useValue: { now: () => new Date('2026-09-29T12:00:00Z') },
        },
      ],
    }).compile();
    service = module.get(PersonsService);
  });

  it('deduplicates a phone number only inside the requested site', async () => {
    repository.findByPhone.mockResolvedValue({ person_id: 10, site_id: 2 });
    const result = await service.createPerson(
      { lastName: 'Ben Ali', phoneNumber: '+21698765432' },
      2,
      user,
    );
    expect(repository.findByPhone).toHaveBeenCalledWith(
      2,
      '+21698765432',
      undefined,
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(result.person_id).toBe(10);
  });

  it('creates a person when no identity exists in that site', async () => {
    repository.findByPhone.mockResolvedValue(null);
    repository.create.mockResolvedValue({ person_id: 20, site_id: 2 });
    const result = await service.createPerson(
      {
        firstName: 'Amine',
        lastName: 'Ben Ali',
        phoneNumber: '+21698765432',
      },
      2,
      user,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Amine' }),
      2,
      1,
      new Date('2026-09-29T12:00:00Z'),
      undefined,
    );
    expect(result.person_id).toBe(20);
  });

  it('hides a person outside the user site scope', async () => {
    scope.getUserScope.mockResolvedValue({
      isGlobal: false,
      siteIds: [1],
      queueIds: [],
    });
    repository.existsInSites.mockResolvedValue(false);
    await expect(service.findPersonById(42, user)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', { personId: 42 }),
    );
    expect(repository.existsInSites).toHaveBeenCalledWith(42, [1]);
  });

  it('soft deletes a person and its notes through one repository operation', async () => {
    repository.findActiveById.mockResolvedValue({ person_id: 42, site_id: 1 });
    await expect(service.deletePerson(42, user)).resolves.toEqual({
      id: 42,
      deleted: true,
    });
    expect(repository.softDeleteWithNotes).toHaveBeenCalledWith(
      42,
      1,
      new Date('2026-09-29T12:00:00Z'),
    );
  });

  it('delegates paginated notes to the repository', async () => {
    repository.findNotes.mockResolvedValue({
      total: 1,
      items: [{ note_id: 1, person_id: 10, content: 'VIP' }],
    });
    const pagination = Object.assign(new PaginationDto(), {
      page: 3,
      pageSize: 2,
    });
    const result = await service.findPersonNotes(10, pagination, user);
    expect(repository.findNotes).toHaveBeenCalledWith({
      personId: 10,
      sortField: 'created_at',
      sortOrder: 'DESC',
      pageSize: 2,
      offset: 4,
    });
    expect(result).toMatchObject({ page: 3, pageSize: 2, total: 1 });
  });
});
