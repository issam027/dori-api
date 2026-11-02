import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { ReportsService } from './reports.service';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('ReportsService monitoring series', () => {
  const manager = {
    userId: '00000000-0000-4000-8000-000000000001',
    roles: ['manager'],
  } as AuthenticatedUser;
  const scopeService = {
    getUserScope: jest.fn().mockResolvedValue({
      isGlobal: false,
      siteIds: ['00000000-0000-4000-8000-000000000001'],
      queueIds: ['00000000-0000-4000-8000-000000000010'],
    }),
    assertQueuesAccess: jest.fn(ScopeService.prototype.assertQueuesAccess),
    assertSiteAccess: jest.fn(ScopeService.prototype.assertSiteAccess),
  };
  const repository = {
    findScopeIdentities: jest.fn(),
    getMonitoringSeries: jest.fn(),
  };
  const service = new ReportsService(
    repository as never,
    scopeService as never,
    new ClockService(),
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects an inaccessible queue before executing any report query', async () => {
    await expect(
      service.getSeries(
        Object.assign(new ReportSeriesQueryDto(), {
          queueIds: '00000000-0000-4000-8000-000000000099',
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-02T00:00:00Z',
        }),
        manager,
      ),
    ).rejects.toMatchObject({ code: 'QUEUE_NOT_FOUND' });
    expect(scopeService.getUserScope).toHaveBeenCalledTimes(1);
    expect(repository.findScopeIdentities).not.toHaveBeenCalled();
    expect(repository.getMonitoringSeries).not.toHaveBeenCalled();
  });

  it('returns null durations and coherent zero totals for an empty period', async () => {
    repository.findScopeIdentities.mockResolvedValue([
      {
        queue_id: '00000000-0000-4000-8000-000000000010',
        queue_name: 'Accueil',
        timezone: 'Europe/Paris',
      },
    ]);
    repository.getMonitoringSeries.mockResolvedValue({
      totals: {
        registered: 0,
        served: 0,
        no_show: 0,
        cancelled: 0,
        average_wait_minutes: null,
        average_service_minutes: null,
      },
      series: [],
      byQueue: [],
      byQueueSeries: [],
      byUser: [],
      byTier: [],
      byEntryType: [],
      byStatus: [],
    });
    const query = Object.assign(new ReportSeriesQueryDto(), {
      queueIds: '00000000-0000-4000-8000-000000000010',
      from: '2026-10-01T00:00:00+02:00',
      to: '2026-10-02T00:00:00+02:00',
      bucket: 'day' as const,
    });

    const result = await service.getSeries(query, manager);

    expect(scopeService.getUserScope).toHaveBeenCalledTimes(1);
    expect(scopeService.assertQueuesAccess).toHaveBeenCalledTimes(1);
    expect(result.totals.averageWaitMinutes).toBeNull();
    expect(result.totals.registered).toBe(0);
    expect(result.breakdowns.byQueue).toEqual([]);
  });

  it('forces a non-supervisor to their own activity', async () => {
    const operator = {
      userId: '00000000-0000-4000-8000-000000000007',
      roles: ['operator'],
    } as AuthenticatedUser;
    repository.findScopeIdentities.mockResolvedValue([
      {
        queue_id: '00000000-0000-4000-8000-000000000010',
        queue_name: 'Accueil',
        timezone: 'Europe/Paris',
      },
    ]);
    repository.getMonitoringSeries.mockResolvedValue({
      totals: {},
      series: [],
      byQueue: [],
      byQueueSeries: [],
      byUser: [],
      byTier: [],
      byEntryType: [],
      byStatus: [],
    });
    await service.getSeries(
      Object.assign(new ReportSeriesQueryDto(), {
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-02T00:00:00Z',
      }),
      operator,
    );
    expect(repository.getMonitoringSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['00000000-0000-4000-8000-000000000007'],
      }),
    );
  });
});
