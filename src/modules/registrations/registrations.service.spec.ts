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
import { NotificationTemplateService } from '../../core/notifications/notification-template.service';
import {
  CreateRegistrationDto,
  RegistrationAvailabilityQueryDto,
} from './dto/registration.dto';
import { QueueWaitEstimationService } from '../queue-estimation/queue-wait-estimation.service';

describe('RegistrationsService ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ERR-02 PERSON_NOT_FOUND', () => {
  let service: RegistrationsService;
  let dataSourceMock: { query: jest.Mock; transaction: jest.Mock };
  let personsServiceMock: { createPerson: jest.Mock };

  const adminUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
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
            addMinutes: jest.fn(
              (date: Date, minutes: number) =>
                new Date(date.getTime() + minutes * 60_000),
            ),
          },
        },
        { provide: PersonsService, useValue: personsServiceMock },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'tracking.tokenTtlMinutes'
                ? 1440
                : 'http://localhost:5173',
            ),
          },
        },
        {
          provide: NotificationTemplateService,
          useValue: {
            templateKey: jest.fn(),
            buildTrackingUrl: jest.fn(),
            render: jest.fn(),
          },
        },
        {
          provide: QueueWaitEstimationService,
          useValue: { estimate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  it('should throw PERSON_NOT_FOUND (404) when personId does not exist in dorify.dori_person', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dorify.dori_queue q JOIN dorify.dori_site')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000007' }];
      }
      if (sql.includes('SELECT person_id FROM dorify.dori_person')) {
        return [];
      }
      if (sql.includes('pg_advisory_xact_lock')) return [];
      return [];
    });

    const dto: CreateRegistrationDto = {
      personId: '00000000-0000-4000-8000-000000999999',
      queueId: '00000000-0000-4000-8000-000000000001',
      tierId: '00000000-0000-4000-8000-000000000001',
      entryType: 'walkin',
    };

    await expect(service.createRegistration(dto, adminUser)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', {
        personId: '00000000-0000-4000-8000-000000999999',
      }),
    );
  });

  it('should throw PERSON_NOT_FOUND (404) when person exists but is inactive or deleted', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dorify.dori_queue q JOIN dorify.dori_site')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000007' }];
      }
      if (sql.includes('SELECT person_id FROM dorify.dori_person')) {
        return [];
      }
      return [];
    });

    const dto: CreateRegistrationDto = {
      personId: '00000000-0000-4000-8000-000000000042',
      queueId: '00000000-0000-4000-8000-000000000001',
      tierId: '00000000-0000-4000-8000-000000000001',
      entryType: 'walkin',
    };

    await expect(service.createRegistration(dto, adminUser)).rejects.toThrow(
      new DoriException('PERSON_NOT_FOUND', {
        personId: '00000000-0000-4000-8000-000000000042',
      }),
    );
  });

  it('should proceed to tier validation when person belongs to the queue site', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dorify.dori_queue q JOIN dorify.dori_site')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000007' }];
      }
      if (sql.includes('SELECT person_id FROM dorify.dori_person')) {
        return [{ person_id: '00000000-0000-4000-8000-000000000010' }];
      }
      if (sql.includes('FROM dorify.dori_queue_service_tier')) {
        return [];
      }
      return [];
    });

    const dto: CreateRegistrationDto = {
      personId: '00000000-0000-4000-8000-000000000010',
      queueId: '00000000-0000-4000-8000-000000000001',
      tierId: '00000000-0000-4000-8000-000000000001',
      entryType: 'walkin',
    };

    await expect(service.createRegistration(dto, adminUser)).rejects.toThrow(
      new DoriException('TIER_NOT_OFFERED_BY_QUEUE', {
        tierId: '00000000-0000-4000-8000-000000000001',
        queueId: '00000000-0000-4000-8000-000000000001',
      }),
    );
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining('person_id = $1 AND site_id = $2'),
      [
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000007',
      ],
    );
  });

  it('creates an inline person in the queue site', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dorify.dori_queue q JOIN dorify.dori_site')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000007' }];
      }
      if (sql.includes('FROM dorify.dori_queue_service_tier')) return [];
      return [];
    });
    personsServiceMock.createPerson.mockResolvedValue({
      person_id: '00000000-0000-4000-8000-000000000015',
    });

    const dto = {
      person: {
        firstName: 'Nadia',
        lastName: 'Ben Ali',
        phoneNumber: '+21698765432',
        email: 'nadia@example.com',
      },
      queueId: '00000000-0000-4000-8000-000000000001',
      tierId: '00000000-0000-4000-8000-000000000001',
      entryType: 'walkin' as const,
    };

    await expect(service.createRegistration(dto, adminUser)).rejects.toThrow(
      DoriException,
    );
    expect(personsServiceMock.createPerson).toHaveBeenCalledWith(
      dto.person,
      '00000000-0000-4000-8000-000000000007',
      adminUser,
      expect.objectContaining({ query: expect.any(Function) }),
    );
  });
});
describe('RegistrationsService reschedule ticket numbering', () => {
  const user: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'admin',
    roles: ['admin'],
    permissions: ['appointment_manage'],
    userType: 'human',
  };

  it('allocates a new daily ticket while preserving registrationId when the business day changes', async () => {
    const now = new Date('2026-10-17T10:00:00Z');
    const newTime = new Date('2026-10-19T09:00:00Z');
    const tx = {
      lockAndCountSlot: jest.fn().mockResolvedValue(0),
      nextTicketNumber: jest.fn().mockResolvedValue(7),
      reschedule: jest.fn().mockResolvedValue({
        registration_id: '00000000-0000-4000-8000-000000000042',
        ticket_number: 'H0007',
        appointment_status: 'rescheduled',
        status: 'booked',
        scheduled_time: newTime,
        priority_reference_time: newTime,
      }),
    };
    const repository = {
      findForReschedule: jest.fn().mockResolvedValue({
        registration_id: '00000000-0000-4000-8000-000000000042',
        queue_id: '00000000-0000-4000-8000-000000000003',
        queue_code: 'H0000',
        business_date: '2026-10-18',
        entry_type: 'appointment',
        status: 'booked',
        timezone: 'Europe/Berlin',
        slot_capacity: 2,
      }),
      transaction: jest.fn((work) => work(tx)),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      { checkQueueAccess: jest.fn() } as unknown as ScopeService,
      {
        now: jest.fn(() => now),
        parseInTimezone: jest.fn(() => newTime),
        dateInTimezone: jest.fn(() => '2026-10-19'),
      } as unknown as ClockService,
      {} as PersonsService,
      {} as ConfigService,
      {} as NotificationTemplateService,
    );

    await expect(
      service.reschedule(
        '00000000-0000-4000-8000-000000000042',
        { scheduledTime: newTime.toISOString() },
        user,
      ),
    ).resolves.toMatchObject({
      registrationId: '00000000-0000-4000-8000-000000000042',
      ticketNumber: 'H0007',
    });
    expect(tx.nextTicketNumber).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      '2026-10-19',
      now,
    );
    expect(tx.reschedule).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      newTime,
      '2026-10-19',
      'H0007',
      now,
    );
  });

  it('keeps the current ticket when the appointment stays on the same business day', async () => {
    const now = new Date('2026-10-17T10:00:00Z');
    const newTime = new Date('2026-10-18T14:00:00Z');
    const tx = {
      lockAndCountSlot: jest.fn().mockResolvedValue(0),
      nextTicketNumber: jest.fn(),
      reschedule: jest.fn().mockResolvedValue({
        registration_id: '00000000-0000-4000-8000-000000000042',
        ticket_number: 'H0003',
        appointment_status: 'rescheduled',
        status: 'booked',
        scheduled_time: newTime,
        priority_reference_time: newTime,
      }),
    };
    const repository = {
      findForReschedule: jest.fn().mockResolvedValue({
        registration_id: '00000000-0000-4000-8000-000000000042',
        queue_id: '00000000-0000-4000-8000-000000000003',
        queue_code: 'H0000',
        business_date: '2026-10-18',
        entry_type: 'appointment',
        status: 'booked',
        timezone: 'Europe/Berlin',
        slot_capacity: 2,
      }),
      transaction: jest.fn((work) => work(tx)),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      { checkQueueAccess: jest.fn() } as unknown as ScopeService,
      {
        now: jest.fn(() => now),
        parseInTimezone: jest.fn(() => newTime),
        dateInTimezone: jest.fn(() => '2026-10-18'),
      } as unknown as ClockService,
      {} as PersonsService,
      {} as ConfigService,
      {} as NotificationTemplateService,
    );

    await service.reschedule(
      '00000000-0000-4000-8000-000000000042',
      { scheduledTime: newTime.toISOString() },
      user,
    );

    expect(tx.nextTicketNumber).not.toHaveBeenCalled();
    expect(tx.reschedule).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000042',
      newTime,
      '2026-10-18',
      undefined,
      now,
    );
  });
});

describe('RegistrationsService public position', () => {
  it('returns the counter name and call timestamp for a called client', async () => {
    const calledAt = new Date('2026-10-15T09:42:18.000Z');
    const repository = {
      findByTrackingToken: jest.fn().mockResolvedValue({
        registration_tracking_token_valid_until: new Date(
          '2026-10-16T09:42:18.000Z',
        ),
        ticket_number: 'A-012',
        status: 'in_progress',
        thread_number: 4,
        counter_name: 'Guichet 04',
        called_at: calledAt,
        queue_id: '00000000-0000-4000-8000-000000000001',
        queue_name: 'Accueil',
      }),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      {} as ScopeService,
      {
        now: jest.fn(() => new Date('2026-10-15T10:00:00.000Z')),
        parse: jest.fn((value: Date | string) => new Date(value)),
      } as unknown as ClockService,
      {} as PersonsService,
      {
        getOrThrow: jest.fn(() => 60),
      } as unknown as ConfigService,
      {} as NotificationTemplateService,
    );

    await expect(
      service.getPublicPosition('550e8400-e29b-41d4-a716-446655440000'),
    ).resolves.toMatchObject({
      status: 'in_progress',
      registrationStatus: 'in_progress',
      counterNumber: 4,
      counterName: 'Guichet 04',
      calledAt,
      queueId: '00000000-0000-4000-8000-000000000001',
      queueName: 'Accueil',
    });
  });

  it('returns the queue id while the client is waiting', async () => {
    const repository = {
      findByTrackingToken: jest.fn().mockResolvedValue({
        registration_tracking_token_valid_until: new Date(
          '2026-10-16T09:42:18.000Z',
        ),
        ticket_number: 'A-012',
        status: 'waiting',
        queue_id: '00000000-0000-4000-8000-000000000001',
        queue_name: 'Accueil',
      }),
      countWaitingBefore: jest.fn().mockResolvedValue(2),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      {} as ScopeService,
      {
        now: jest.fn(() => new Date('2026-10-15T10:00:00.000Z')),
        parse: jest.fn((value: Date | string) => new Date(value)),
      } as unknown as ClockService,
      {} as PersonsService,
      { getOrThrow: jest.fn(() => 60) } as unknown as ConfigService,
      {} as NotificationTemplateService,
    );

    await expect(
      service.getPublicPosition('550e8400-e29b-41d4-a716-446655440000'),
    ).resolves.toMatchObject({
      status: 'waiting',
      queueId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it.each(['served', 'no_show', 'cancelled', 'expired'])(
    'returns the terminal registration status %s',
    async (registrationStatus) => {
      const repository = {
        findByTrackingToken: jest.fn().mockResolvedValue({
          registration_tracking_token_valid_until: new Date(
            '2026-10-16T09:42:18.000Z',
          ),
          ticket_number: 'A-012',
          status: registrationStatus,
          thread_number: 4,
          counter_name: 'Guichet 04',
          called_at: new Date('2026-10-15T09:42:18.000Z'),
          queue_id: '00000000-0000-4000-8000-000000000001',
          queue_name: 'Accueil',
          closed_at: new Date('2026-10-15T09:50:00.000Z'),
        }),
      };
      const service = new RegistrationsService(
        repository as unknown as RegistrationsRepository,
        {} as ScopeService,
        {
          now: jest.fn(() => new Date('2026-10-15T10:00:00.000Z')),
          parse: jest.fn((value: Date | string) => new Date(value)),
        } as unknown as ClockService,
        {} as PersonsService,
        { getOrThrow: jest.fn(() => 60) } as unknown as ConfigService,
        {} as NotificationTemplateService,
      );

      const response = await service.getPublicPosition(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(response).toMatchObject({
        status: registrationStatus,
        registrationStatus,
      });
      expect(response).not.toHaveProperty('queueId');
    },
  );

  it('does not return the queue id in the degraded closed response', async () => {
    const repository = {
      findByTrackingToken: jest.fn().mockResolvedValue({
        registration_tracking_token_valid_until: new Date(
          '2026-10-16T09:42:18.000Z',
        ),
        status: 'served',
        closed_at: new Date('2026-10-15T08:00:00.000Z'),
        queue_id: '00000000-0000-4000-8000-000000000001',
      }),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      {} as ScopeService,
      {
        now: jest.fn(() => new Date('2026-10-15T10:00:00.000Z')),
        parse: jest.fn((value: Date | string) => new Date(value)),
      } as unknown as ClockService,
      {} as PersonsService,
      { getOrThrow: jest.fn(() => 60) } as unknown as ConfigService,
      {} as NotificationTemplateService,
    );

    const response = await service.getPublicPosition(
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(response).toEqual({
      status: 'closed',
      registrationStatus: 'served',
    });
    expect(response).not.toHaveProperty('queueId');
  });
});

describe('RegistrationsService ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â creation response', () => {
  const user: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
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
        site_id: '00000000-0000-4000-8000-000000000007',
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
        registration_id: '00000000-0000-4000-8000-000000000010',
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
      enqueueRealtime: jest.fn().mockResolvedValue(undefined),
    };
    const repository = {
      transaction: jest.fn((work: (value: typeof tx) => unknown) => work(tx)),
    };
    const clock = {
      now: jest.fn(() => new Date('2026-10-14T10:00:00Z')),
      todayInTimezone: jest.fn(() => '2026-10-14'),
      endOfDayInTimezone: jest.fn(() => new Date('2026-10-14T21:59:59Z')),
      addMinutes: jest.fn(
        (date: Date, minutes: number) =>
          new Date(date.getTime() + minutes * 60_000),
      ),
    };
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      { checkQueueAccess: jest.fn() } as unknown as ScopeService,
      clock as unknown as ClockService,
      {} as PersonsService,
      {
        getOrThrow: jest.fn((key: string) =>
          key === 'tracking.tokenTtlMinutes' ? 1440 : 'http://localhost:5173',
        ),
      } as unknown as ConfigService,
      {
        templateKey: jest.fn(),
        buildTrackingUrl: jest.fn(),
        render: jest.fn(),
      } as unknown as NotificationTemplateService,
      undefined,
    );

    const response = await service.createRegistration(
      {
        personId: '00000000-0000-4000-8000-000000000003',
        queueId: '00000000-0000-4000-8000-000000000002',
        tierId: '00000000-0000-4000-8000-000000000001',
        entryType: 'walkin',
      },
      user,
    );

    expect(response).toMatchObject({
      registrationTrackingToken: token,
      registrationTrackingTokenValidUntil: new Date('2026-10-14T21:59:59Z'),
    });
    expect(response).not.toHaveProperty('trackingUrl');
    expect(tx.createWelcomeNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationId: '00000000-0000-4000-8000-000000000010',
        trackingToken: '550e8400-e29b-41d4-a716-446655440000',
        ticketNumber: 'A-001',
        now: new Date('2026-10-14T10:00:00Z'),
      }),
    );
    expect(tx.enqueueRealtime).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
      'queue_display_changed',
      expect.objectContaining({ reason: 'registration_created' }),
      new Date('2026-10-14T10:00:00Z'),
    );
  });

  describe('getAvailability', () => {
    it('correctly marks booked slots when bookings exist, even if pg driver returns business_date as a Date object', async () => {
      const scheduledUtc = '2026-09-01T07:00:00.000Z'; // 08:00 in Africa/Tunis
      const repository = {
        findAvailabilityConfig: jest.fn().mockResolvedValue({
          queue_id: '00000000-0000-4000-8000-000000000001',
          site_id: '00000000-0000-4000-8000-000000000002',
          timezone: 'Africa/Tunis',
          appointments_enabled: true,
          appointment_slot_duration: 30,
          slot_capacity: 1,
          working_hours_start: '08:00',
          working_hours_end: '09:00',
          break_start: null,
          break_end: null,
        }),
        findBookedSlotsBetween: jest.fn().mockResolvedValue([
          {
            // pg driver converts DATE into a JS Date object
            business_date: new Date('2026-08-31T23:00:00.000Z'),
            scheduled_time: new Date(scheduledUtc),
            count: 1,
          },
        ]),
      };

      const clock = new ClockService();
      const service = new RegistrationsService(
        repository as unknown as RegistrationsRepository,
        { checkQueueAccess: jest.fn() } as unknown as ScopeService,
        clock,
        {} as PersonsService,
        { getOrThrow: jest.fn() } as unknown as ConfigService,
        {} as NotificationTemplateService,
      );

      const result = await service.getAvailability(
        '00000000-0000-4000-8000-000000000001',
        {
          dateFrom: '2026-09-01',
          dateTo: '2026-09-01',
          summaryOnly: false,
        } as RegistrationAvailabilityQueryDto,
        user,
      );

      expect(result.days).toHaveLength(1);
      const day = result.days[0];
      expect(day.businessDate).toBe('2026-09-01');
      expect(day.capacity).toBe(2);
      expect(day.booked).toBe(1);
      expect(day.available).toBe(1);

      expect(day.slots).toHaveLength(2);
      const bookedSlot = day.slots?.find((s) => s.time === scheduledUtc);
      expect(bookedSlot).toBeDefined();
      expect(bookedSlot?.booked).toBe(1);
      expect(bookedSlot?.available).toBe(0);
      expect(bookedSlot?.isAvailable).toBe(false);

      const freeSlot = day.slots?.find((s) => s.time !== scheduledUtc);
      expect(freeSlot).toBeDefined();
      expect(freeSlot?.booked).toBe(0);
      expect(freeSlot?.available).toBe(1);
      expect(freeSlot?.isAvailable).toBe(true);
    });

    it('omits slots and returns correct daily totals when summaryOnly is true', async () => {
      const scheduledUtc = '2026-09-01T07:00:00.000Z';
      const repository = {
        findAvailabilityConfig: jest.fn().mockResolvedValue({
          queue_id: '00000000-0000-4000-8000-000000000001',
          site_id: '00000000-0000-4000-8000-000000000002',
          timezone: 'Africa/Tunis',
          appointments_enabled: true,
          appointment_slot_duration: 30,
          slot_capacity: 1,
          working_hours_start: '08:00',
          working_hours_end: '09:00',
          break_start: null,
          break_end: null,
        }),
        findBookedSlotsBetween: jest.fn().mockResolvedValue([
          {
            business_date: '2026-09-01',
            scheduled_time: new Date(scheduledUtc),
            count: 1,
          },
        ]),
      };

      const clock = new ClockService();
      const service = new RegistrationsService(
        repository as unknown as RegistrationsRepository,
        { checkQueueAccess: jest.fn() } as unknown as ScopeService,
        clock,
        {} as PersonsService,
        { getOrThrow: jest.fn() } as unknown as ConfigService,
        {} as NotificationTemplateService,
      );

      const result = await service.getAvailability(
        '00000000-0000-4000-8000-000000000001',
        {
          dateFrom: '2026-09-01',
          dateTo: '2026-09-01',
          summaryOnly: true,
        } as RegistrationAvailabilityQueryDto,
        user,
      );

      expect(result.days).toHaveLength(1);
      expect(result.days[0].slots).toBeUndefined();
      expect(result.days[0].capacity).toBe(2);
      expect(result.days[0].booked).toBe(1);
      expect(result.days[0].available).toBe(1);
    });

    it('marks non-working days as closed with 0 capacity and empty slots', async () => {
      const repository = {
        findAvailabilityConfig: jest.fn().mockResolvedValue({
          queue_id: '00000000-0000-4000-8000-000000000001',
          site_id: '00000000-0000-4000-8000-000000000002',
          timezone: 'Africa/Tunis',
          appointments_enabled: true,
          appointment_slot_duration: 30,
          slot_capacity: 1,
          working_hours_start: '08:00',
          working_hours_end: '17:00',
          working_days: [1, 2, 3, 4, 5],
        }),
        findBookedSlotsBetween: jest.fn().mockResolvedValue([]),
      };

      const clock = new ClockService();
      const service = new RegistrationsService(
        repository as unknown as RegistrationsRepository,
        { checkQueueAccess: jest.fn() } as unknown as ScopeService,
        clock,
        {} as PersonsService,
        { getOrThrow: jest.fn() } as unknown as ConfigService,
        {} as NotificationTemplateService,
      );

      // 2026-09-06 is Sunday (isoDay 7)
      const result = await service.getAvailability(
        '00000000-0000-4000-8000-000000000001',
        {
          dateFrom: '2026-09-06',
          dateTo: '2026-09-06',
          summaryOnly: false,
        } as RegistrationAvailabilityQueryDto,
        user,
      );

      expect(result.days).toHaveLength(1);
      const sunday = result.days[0];
      expect(sunday.businessDate).toBe('2026-09-06');
      expect(sunday.isOpen).toBe(false);
      expect(sunday.capacity).toBe(0);
      expect(sunday.booked).toBe(0);
      expect(sunday.available).toBe(0);
      expect(sunday.slots).toEqual([]);
    });
  });

  it('publishes display and tracking invalidations after appointment check-in', async () => {
    const queueId = '00000000-0000-4000-8000-000000000002';
    const registrationId = '00000000-0000-4000-8000-000000000003';
    const now = new Date('2026-10-26T09:00:00.000Z');
    const checkedIn = { registration_id: registrationId, status: 'waiting' };
    const repository = {
      findForCheckIn: jest.fn().mockResolvedValue({
        queue_id: queueId,
        entry_type: 'appointment',
        status: 'booked',
        scheduled_time: now,
        late_tolerance_minutes: 60,
      }),
      checkIn: jest.fn().mockResolvedValue(checkedIn),
      findById: jest.fn().mockResolvedValue(checkedIn),
    };
    const user = {
      userId: '00000000-0000-4000-8000-000000000001',
      username: 'admin',
      roles: ['admin'],
      permissions: ['appointment_checkin'],
      userType: 'human',
    } as AuthenticatedUser;
    const service = new RegistrationsService(
      repository as unknown as RegistrationsRepository,
      { checkQueueAccess: jest.fn() } as unknown as ScopeService,
      {
        now: jest.fn(() => now),
        parse: jest.fn((value: Date | string) => new Date(value)),
        addMinutes: jest.fn(
          (date: Date, minutes: number) =>
            new Date(date.getTime() + minutes * 60_000),
        ),
      } as unknown as ClockService,
      {} as PersonsService,
      {} as ConfigService,
      {} as NotificationTemplateService,
      undefined,
    );

    await service.checkIn(registrationId, user);

    expect(repository.checkIn).toHaveBeenCalledWith(registrationId, now);
  });
});
