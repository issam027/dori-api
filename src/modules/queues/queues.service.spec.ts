import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { QueuesService } from './queues.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { QueuesRepository } from './queues.repository';

describe('QueuesService ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â SEC-04 assignOperator', () => {
  let service: QueuesService;
  let dataSourceMock: { query: jest.Mock; transaction: jest.Mock };
  let scopeServiceMock: {
    checkQueueAccess: jest.Mock;
    checkSiteAccess: jest.Mock;
    invalidateUserScope: jest.Mock;
    clearAllScopeCache: jest.Mock;
  };

  const managerUser: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    username: 'manager_user',
    roles: ['manager'],
    permissions: ['user_queue_assign'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
      transaction: jest.fn(async (callback) =>
        callback({ query: dataSourceMock.query }),
      ),
    };

    scopeServiceMock = {
      checkQueueAccess: jest.fn().mockResolvedValue(undefined),
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
      invalidateUserScope: jest.fn(),
      clearAllScopeCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: QueuesRepository,
          useFactory: (dataSource: DataSource) =>
            new QueuesRepository(dataSource),
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

    service = module.get<QueuesService>(QueuesService);
  });

  it('should throw USER_NOT_FOUND when target user does not exist in dorify.dori_user', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dorify.dori_queue')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000010' }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dorify.dori_user')) {
        return [];
      }
      return [];
    });

    await expect(
      service.assignOperator(
        '00000000-0000-4000-8000-000000000005',
        '00000000-0000-4000-8000-000000000999',
        managerUser,
      ),
    ).rejects.toThrow(
      new DoriException('USER_NOT_FOUND', {
        userId: '00000000-0000-4000-8000-000000000999',
      }),
    );
  });

  it('should throw ACCOUNT_LOCKED when target user is inactive', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dorify.dori_queue')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000010' }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dorify.dori_user')) {
        return [
          { user_id: '00000000-0000-4000-8000-000000000002', is_active: false },
        ];
      }
      return [];
    });

    await expect(
      service.assignOperator(
        '00000000-0000-4000-8000-000000000005',
        '00000000-0000-4000-8000-000000000002',
        managerUser,
      ),
    ).rejects.toThrow(
      new DoriException('ACCOUNT_LOCKED', {
        userId: '00000000-0000-4000-8000-000000000002',
      }),
    );
  });

  it('should throw FORBIDDEN_ROLE_ESCALATION when target user does not have operator role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dorify.dori_queue')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000010' }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dorify.dori_user')) {
        return [
          { user_id: '00000000-0000-4000-8000-000000000002', is_active: true },
        ];
      }
      if (sql.includes("r.role_name IN ('operator', 'kiosk')")) {
        return [];
      }
      return [];
    });

    await expect(
      service.assignOperator(
        '00000000-0000-4000-8000-000000000005',
        '00000000-0000-4000-8000-000000000002',
        managerUser,
      ),
    ).rejects.toThrow(new DoriException('FORBIDDEN_ROLE_ESCALATION'));
  });

  it('should assign operator successfully when user exists, is active and has operator role', async () => {
    dataSourceMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT site_id FROM dorify.dori_queue')) {
        return [{ site_id: '00000000-0000-4000-8000-000000000010' }];
      }
      if (sql.includes('SELECT user_id, is_active FROM dorify.dori_user')) {
        return [
          { user_id: '00000000-0000-4000-8000-000000000002', is_active: true },
        ];
      }
      if (sql.includes("r.role_name IN ('operator', 'kiosk')")) {
        return [{ user_id: '00000000-0000-4000-8000-000000000002' }];
      }
      if (sql.includes('INSERT INTO dorify.dori_user_queue_assignment')) {
        return [];
      }
      return [];
    });

    const result = await service.assignOperator(
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000002',
      managerUser,
    );
    expect(result).toEqual({
      queueId: '00000000-0000-4000-8000-000000000005',
      userId: '00000000-0000-4000-8000-000000000002',
      assigned: true,
    });
    expect(scopeServiceMock.invalidateUserScope).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
    );
  });

  it('resolves site defaults and queue overrides, including currency and locale', async () => {
    dataSourceMock.query.mockResolvedValue([
      {
        queue_id: '00000000-0000-4000-8000-000000000005',
        queue_code: 'CARDIO',
        site_id: '00000000-0000-4000-8000-000000000010',
        queue_name: 'Cardiologie',
        average_wait_time: 10,
        thread_count: 2,
        currency: 'EUR',
        default_currency: 'TND',
        locale: null,
        default_locale: 'fr',
        appointments_enabled: null,
        default_appointments_enabled: true,
        appointment_slot_duration: null,
        default_appointment_slot_duration: 15,
        slot_capacity: null,
        default_slot_capacity: 2,
        working_hours_start: null,
        default_working_hours_start: '08:00:00',
        working_hours_end: null,
        default_working_hours_end: '17:00:00',
        break_start: null,
        default_break_start: '12:00:00',
        break_end: null,
        default_break_end: '14:00:00',
        late_tolerance_minutes: null,
        default_late_tolerance_minutes: 60,
        base_weight_walkin: null,
        default_base_weight_walkin: '0',
        base_weight_appointment: null,
        default_base_weight_appointment: '60',
        escalation_rate_walkin: null,
        default_escalation_rate_walkin: '1',
        escalation_rate_appointment: null,
        default_escalation_rate_appointment: '1',
        carry_over_waiting: null,
        default_carry_over_waiting: false,
        daily_reset_mode: null,
        default_daily_reset_mode: 'close_all',
        daily_reset_time: null,
        default_daily_reset_time: '03:00:00',
        is_active: true,
        created_at: new Date('2026-10-06T10:00:00Z'),
        updated_at: new Date('2026-10-06T10:00:00Z'),
      },
    ]);

    const result = await service.findQueueById(
      '00000000-0000-4000-8000-000000000005',
      managerUser,
    );

    expect(result.currency).toBe('EUR');
    expect(result.locale).toBe('fr');
    expect(result.appointmentsEnabled).toBe(true);
    expect(result.configOrigins.currency).toBe('overridden');
    expect(result.configOrigins.locale).toBe('inherited');
    expect(result.configOrigins.appointmentsEnabled).toBe('inherited');
    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(result.configOrigins.workingDays).toBe('inherited');
  });

  describe('deleteQueue (DAT-05)', () => {
    it('should throw QUEUE_NOT_FOUND when queue does not exist or is inactive', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM dorify.dori_queue q')) {
          return [];
        }
        return [];
      });

      await expect(
        service.deleteQueue(
          '00000000-0000-4000-8000-000000000999',
          managerUser,
        ),
      ).rejects.toThrow(
        new DoriException('QUEUE_NOT_FOUND', {
          queueId: '00000000-0000-4000-8000-000000000999',
        }),
      );
    });

    it('should soft delete queue, cascade to tiers and close open sessions', async () => {
      const queries: { sql: string; params: any[] }[] = [];
      dataSourceMock.query.mockImplementation(
        async (sql: string, params: any[]) => {
          queries.push({ sql, params });
          if (sql.includes('FROM dorify.dori_queue q')) {
            return [
              {
                queue_id: '00000000-0000-4000-8000-000000000005',
                is_active: true,
              },
            ];
          }
          return [];
        },
      );

      const result = await service.deleteQueue(
        '00000000-0000-4000-8000-000000000005',
        managerUser,
      );
      expect(result).toEqual({
        queueId: '00000000-0000-4000-8000-000000000005',
        deleted: true,
      });

      const queueUpdate = queries.find(
        (q) =>
          q.sql.includes('UPDATE dorify.dori_queue') &&
          q.sql.includes('SET is_active = FALSE'),
      );
      expect(queueUpdate).toBeDefined();
      expect(queueUpdate?.params[2]).toBe(
        '00000000-0000-4000-8000-000000000005',
      );

      const tiersUpdate = queries.find(
        (q) =>
          q.sql.includes('UPDATE dorify.dori_queue_service_tier') &&
          q.sql.includes('SET is_active = FALSE'),
      );
      expect(tiersUpdate).toBeDefined();
      expect(tiersUpdate?.params[2]).toBe(
        '00000000-0000-4000-8000-000000000005',
      );

      const sessionsUpdate = queries.find(
        (q) =>
          q.sql.includes('UPDATE dorify.dori_operator_session') &&
          q.sql.includes("closure_reason = 'forced'"),
      );
      expect(sessionsUpdate).toBeDefined();
      expect(sessionsUpdate?.params[2]).toBe(
        '00000000-0000-4000-8000-000000000005',
      );
    });
  });
});
