import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RegistrationsService } from './registrations.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { PersonsService } from '../persons/persons.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';

describe('RegistrationsService — ERR-02 PERSON_NOT_FOUND', () => {
  let service: RegistrationsService;
  let dataSourceMock: { query: jest.Mock };
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
    dataSourceMock = { query: jest.fn() };
    personsServiceMock = { createPerson: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: ScopeService,
          useValue: {
            checkQueueAccess: jest.fn().mockResolvedValue(undefined),
            getUserScope: jest.fn().mockResolvedValue({ isGlobal: true, siteIds: [], queueIds: [] }),
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
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  it('should throw PERSON_NOT_FOUND (404) when personId does not exist in dori_person', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT person_id FROM dori_person')) {
        return [];
      }
      return [];
    });

    const dto = {
      personId: 999999,
      queueId: 1,
      tierId: 1,
      entryType: 'walk-in' as const,
    };

    await expect(service.createRegistration(dto as any, adminUser)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', { personId: 999999 }),
    );
  });

  it('should throw PERSON_NOT_FOUND (404) when person exists but is inactive or deleted', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
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

    await expect(service.createRegistration(dto as any, adminUser)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', { personId: 42 }),
    );
  });

  it('should proceed past person check when personId is valid and active', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT person_id FROM dori_person')) {
        return [{ person_id: 10 }];
      }
      if (sql.includes('FROM dori_site_queue_thread')) {
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

    await expect(service.createRegistration(dto as any, adminUser)).rejects.toThrow(
      new DoriException('QUEUE_NOT_FOUND', { queueId: 1 }),
    );
  });
});
