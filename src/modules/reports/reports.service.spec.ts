import { ReportsService } from './reports.service';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('ReportsService series', () => {
  const user = { userId: 1 } as AuthenticatedUser;
  const scopeService = {
    checkQueueAccess: jest.fn(),
    checkSiteAccess: jest.fn(),
  };
  const repository = {
    findScopeIdentities: jest.fn(),
    getSeries: jest.fn(),
  };
  const service = new ReportsService(
    repository as never,
    scopeService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns null timing and rates for an empty generated bucket', async () => {
    repository.findScopeIdentities.mockResolvedValue([
      {
        queue_id: 10,
        queue_code: 'A00',
        queue_name: 'Accueil',
        site_name: 'Site',
        timezone: 'Europe/Paris',
      },
    ]);
    const empty = {
      registered: 0,
      walkin: 0,
      appointments: 0,
      served: 0,
      no_show: 0,
      expired: 0,
      cancelled: 0,
      avg_wait: null,
      median_wait: null,
      p90_wait: null,
      avg_service: null,
      median_service: null,
      p90_service: null,
    };
    repository.getSeries.mockResolvedValue([
      {
        row_type: 'summary',
        period_start: null,
        period_end: null,
        group_key: null,
        group_label: null,
        timezone: null,
        ...empty,
      },
      {
        row_type: 'bucket',
        period_start: '2026-10-01',
        period_end: '2026-10-01',
        group_key: null,
        group_label: null,
        timezone: null,
        ...empty,
      },
    ]);
    const query = Object.assign(new ReportSeriesQueryDto(), {
      queueIds: '10',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-01',
      includeEmpty: true,
      granularity: 'day' as const,
    });
    const result = await service.getSeries(query, user);
    expect(scopeService.checkQueueAccess).toHaveBeenCalledWith(user, 10);
    expect(result.summary.timing.averageWaitMinutes).toBeNull();
    expect(result.buckets[0].rates.noShowRate).toBeNull();
  });
});
