import { ReportsService } from './reports.service';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('ReportsService monitoring series', () => {
  const manager = {
    userId: 1,
    roles: ['manager'],
  } as AuthenticatedUser;
  const scopeService = {
    getUserScope: jest.fn().mockResolvedValue({
      isGlobal: false,
      siteIds: [1],
      queueIds: [10],
    }),
    checkQueueAccess: jest.fn(),
    checkSiteAccess: jest.fn(),
  };
  const repository = {
    findScopeIdentities: jest.fn(),
    getMonitoringSeries: jest.fn(),
  };
  const service = new ReportsService(
    repository as never,
    scopeService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns null durations and coherent zero totals for an empty period', async () => {
    repository.findScopeIdentities.mockResolvedValue([
      {
        queue_id: 10,
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
      byUser: [],
      byTier: [],
      byEntryType: [],
      byStatus: [],
    });
    const query = Object.assign(new ReportSeriesQueryDto(), {
      queueIds: '10',
      from: '2026-10-01T00:00:00+02:00',
      to: '2026-10-02T00:00:00+02:00',
      bucket: 'day' as const,
    });

    const result = await service.getSeries(query, manager);

    expect(scopeService.checkQueueAccess).toHaveBeenCalledWith(manager, 10);
    expect(result.totals.averageWaitMinutes).toBeNull();
    expect(result.totals.registered).toBe(0);
    expect(result.breakdowns.byQueue).toEqual([]);
  });

  it('forces a non-supervisor to their own activity', async () => {
    const operator = { userId: 7, roles: ['operator'] } as AuthenticatedUser;
    repository.findScopeIdentities.mockResolvedValue([
      { queue_id: 10, queue_name: 'Accueil', timezone: 'Europe/Paris' },
    ]);
    repository.getMonitoringSeries.mockResolvedValue({
      totals: {},
      series: [],
      byQueue: [],
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
      expect.objectContaining({ userIds: [7] }),
    );
  });
});
