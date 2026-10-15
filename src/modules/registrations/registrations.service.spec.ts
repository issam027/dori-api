import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RegistrationsService } from './registrations.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { PersonsService } from '../persons/persons.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { RegistrationsRepository } from './registrations.repository';
import { ConfigService } from '@nestjs/config';

describe('RegistrationsService — ERR-02 PERSON_NOT_FOUND', () => {
  let service: RegistrationsService;
  let dataSourceMock: { query: jest.Mock; transaction: jest.Mock };
  let personsServiceMock: { createPerson: jest.Mock };

  const adminUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin',
    roles: ['admin'],
    permissions: ['registration_create'],
    userType: 'human',
  };

  const fixedNow = new Date('2026-09-29T10:00:00Z');

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
      transaction: jest.fn(async (callback) =>
        callback({ query: dataSourceMock.query }),
      ),
    };
    personsServiceMock = { createPerson: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: RegistrationsRepository,
          useFactory: (dataSource: DataSource) =>
            new RegistrationsRepository(dataSource),
          inject: [DataSource],
        },
        {
          provide: ScopeService,
          useValue: {
            checkQueueAccess: jest.fn().mockResolvedValue(undefined),
            getUserScope: jest
              .fn()
              .mockResolvedValue({ isGlobal: true, siteIds: [], queueIds: [] }),
          },
        },
        {
          provide: ClockService,
          useValue: {
            now: jest.fn(() => fixedNow),
            todayInTimezone: jest.fn(() => '2026-09-29'),
            endOfDayInTimezone: jest.fn(() => new Date('2026-09-29T23:59:59Z')),
            dateInTimezone: jest.fn(() => '2026-09-29'),
          },
        },
        { provide: PersonsService, useValue: personsServiceMock },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(() => 'http://localhost:5173') },
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  it('should throw PERSON_NOT_FOUND (404) when personId does not exist in dori_person', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dori_queue q JOIN dori_site')) {
        return [{ site_id: 7 }];
      }
      if (sql.includes('SELECT person_id FROM dori_person')) {
        return [];
      }
      if (sql.includes('pg_advisory_xact_lock')) return [];
      return [];
    });

    const dto = {
      personId: 999999,
      queueId: 1,
      tierId: 1,
      entryType: 'walk-in' as const,
    };

    await expect(
      service.createRegistration(dto as any, adminUser),
    ).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', { personId: 999999 }),
    );
  });

  it('should throw PERSON_NOT_FOUND (404) when person exists but is inactive or deleted', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dori_queue q JOIN dori_site')) {
        return [{ site_id: 7 }];
      }
      if (sql.includes('SELECT person_id FROM dori_person')) {
        return [];
      }
      return [];
    });

    const dto = {
      personId: 42,
      queueId: 1,
      tierId: 1,
      entryType: 'walk-in' as const,
    };

    await expect(
      service.createRegistration(dto as any, adminUser),
    ).rejects.toThrow(new DoriException('PERSON_NOT_FOUND', { personId: 42 }));
  });

  it('should proceed to tier validation when person belongs to the queue site', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dori_queue q JOIN dori_site')) {
        return [{ site_id: 7 }];
      }
      if (sql.includes('SELECT person_id FROM dori_person')) {
        return [{ person_id: 10 }];
      }
      if (sql.includes('FROM dori_queue_service_tier')) {
        return [];
      }
      return [];
    });

    const dto = {
      personId: 10,
      queueId: 1,
      tierId: 1,
      entryType: 'walk-in' as const,
    };

    await expect(
      service.createRegistration(dto as any, adminUser),
    ).rejects.toThrow(
      new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
        tierId: 1,
        queueId: 1,
      }),
    );
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('person_id = $1 AND site_id = $2'),
      [10, 7],
    );
  });

  it('creates an inline person in the queue site', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dori_queue q JOIN dori_site')) {
        return [{ site_id: 7 }];
      }
      if (sql.includes('FROM dori_queue_service_tier')) return [];
      return [];
    });
    personsServiceMock.createPerson.mockResolvedValue({ person_id: 15 });

    const dto = {
      person: {
        firstName: 'Nadia',
        lastName: 'Ben Ali',
        phoneNumber: '+21698765432',
        email: 'nadia@example.com',
      },
      queueId: 1,
      tierId: 1,
      entryType: 'walkin' as const,
    };

    await expect(service.createRegistration(dto, adminUser)).rejects.toThrow(
      DoriException,
    );
    expect(personsServiceMock.createPerson).toHaveBeenCalledWith(
      dto.person,
      7,
      adminUser,
      expect.objectContaining({ query: expect.any(Function) }),
    );
  });
});

describe('RegistrationsService — creation response', () => {
  const user: AuthenticatedUser = {
    userId: 1,
    username: 'admin',
    roles: ['admin'],
    permissions: ['registration_create'],
    userType: 'human',
  };

  it('always returns the raw tracking token and its expiration', async () => {
    const token = '550e8400-e29b-41d4-a716-446655440000';
    const tx = {
      manager: {},
      findQueueConfig: jest.fn().mockResolvedValue({
        site_id: 7,
        queue_code: 'A-',
        timezone: 'Europe/Berlin',
      }),
      personExistsInSite: jest.fn().mockResolvedValue(true),
      findOfferedTier: jest.fn().mockResolvedValue({
        tier_code: 'STD',
        price: 0,
        currency: 'EUR',
      }),
      hasOpenRegistration: jest.fn().mockResolvedValue(false),
      nextTicketNumber: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue({
        registration_id: 10,
        registration_tracking_token: token,
        ticket_number: 'A-001',
        business_date: '2026-10-14',
        entry_type: 'walkin',
        appointment_status: 'n/a',
        scheduled_time: null,
        status: 'waiting',
        priority_reference_time: new Date('2026-10-14T10:00:00Z'),
      }),
      createWelcomeNotifications: jest.fn().mockResolvedValue(0),
    };
    const repository = {
      transaction: jest.fn((work: (value: typeof tx) => unknown) => work(tx)),
    };
    const clock = {
      now: jest.fn(() => new Date('2026-10-14T10:00:00Z')),
      todayInTimezone: jest.fn(() => '2026-10-14'),
      endOfDayInTimezone: jest.fn(() => new Date('2026-10-14T21:59:59Z')),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      { checkQueueAccess: jest.fn() } as unknown as ScopeService,
      clock as unknown as ClockService,
      {} as PersonsService,
      {
        getOrThrow: jest.fn(() => 'http://localhost:5173'),
      } as unknown as ConfigService,
    );

    const response = await service.createRegistration(
      { personId: 3, queueId: 2, tierId: 1, entryType: 'walkin' },
      user,
    );

    expect(response).toMatchObject({
      registrationTrackingToken: token,
      registrationTrackingTokenValidUntil: new Date('2026-10-14T21:59:59Z'),
    });
    expect(response).not.toHaveProperty('trackingUrl');
    expect(tx.createWelcomeNotifications).toHaveBeenCalledWith({
      registrationId: 10,
      trackingUrl:
        'http://localhost:5173/track?token=550e8400-e29b-41d4-a716-446655440000',
      ticketNumber: 'A-001',
      now: new Date('2026-10-14T10:00:00Z'),
    });
  });
});
