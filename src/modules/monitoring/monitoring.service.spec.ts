import { ClockService } from '../../core/clock/clock.service';
import { MonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');

  function createService(databaseAvailable = true, redisMock?: unknown) {
    const repository = {
      isDatabaseAvailable: jest.fn().mockResolvedValue(databaseAvailable),
      activitySnapshot: jest.fn().mockResolvedValue({
        notifications: { failed: 2, pending: 3 },
        openOperatorSessions: 4,
        registrations: { waiting: 5 },
      }),
      liveSnapshot: jest.fn().mockResolvedValue({
        site: {
          site_id: '00000000-0000-4000-8000-000000000001',
          timezone: 'Europe/Paris',
        },
        queues: [
          {
            queue_id: '00000000-0000-4000-8000-000000000010',
            queue_name: 'Accueil',
            waiting: 12,
            in_progress: 2,
            open_desks: 2,
            active_operators: 2,
            estimated_wait_minutes: 8,
            longest_wait_minutes: 35,
          },
        ],
        operators: [
          {
            user_id: '00000000-0000-4000-8000-000000000007',
            display_name: 'Opérateur',
            queue_id: '00000000-0000-4000-8000-000000000010',
            session_id: '00000000-0000-4000-8000-000000000020',
            connected_at: now,
            registration_id: '00000000-0000-4000-8000-000000000030',
            ticket_number: 'A-001',
          },
        ],
      }),
    } as unknown as MonitoringRepository;
    const clock = {
      now: jest.fn().mockReturnValue(now),
    } as unknown as ClockService;
    const scope = {
      checkSiteAccess: jest.fn(),
    };
    return {
      service: new MonitoringService(
        repository,
        clock,
        scope as never,
        redisMock as never,
      ),
      repository: repository as unknown as {
        activitySnapshot: jest.Mock;
        liveSnapshot: jest.Mock;
      },
      scope,
    };
  }

  it('keeps health limited to process and dependency health', async () => {
    const { service, repository } = createService();
    const result = await service.health();

    expect(result.status).toBe('ok');
    expect(result).toEqual({
      status: 'ok',
      timestamp: '2026-10-15T12:00:00.000Z',
    });
    expect(result).not.toHaveProperty('registrations');
    expect(repository.activitySnapshot).not.toHaveBeenCalled();
  });

  it('keeps metrics limited to technical counters with in-memory fallback', async () => {
    const { service } = createService();
    service.increment('http_requests_total', 2);
    service.increment('http_request_duration_ms_total', 30);

    expect(await service.metrics()).toEqual({
      counters: {
        http_requests_total: 2,
        http_request_duration_ms_total: 30,
      },
      derived: { averageHttpRequestDurationMs: 15 },
      generatedAt: now.toISOString(),
    });
  });

  it('persists and reads metrics from Redis when available', async () => {
    const redisMock = {
      hincrbyfloat: jest.fn().mockResolvedValue('1'),
      hgetall: jest.fn().mockResolvedValue({
        http_requests_total: '10',
        http_request_duration_ms_total: '200',
      }),
    };
    const { service } = createService(true, redisMock);
    service.increment('http_requests_total', 1);
    expect(redisMock.hincrbyfloat).toHaveBeenCalledWith(
      'dori:metrics:counters',
      'http_requests_total',
      1,
    );

    const metrics = await service.metrics();
    expect(metrics).toEqual({
      counters: {
        http_requests_total: 10,
        http_request_duration_ms_total: 200,
      },
      derived: { averageHttpRequestDurationMs: 20 },
      generatedAt: now.toISOString(),
    });
  });

  it('loads business activity only from the activity operation', async () => {
    const { service } = createService();
    await expect(service.activity()).resolves.toEqual({
      notifications: { failed: 2, pending: 3 },
      openOperatorSessions: 4,
      registrations: { waiting: 5 },
      generatedAt: now.toISOString(),
    });
  });

  it('returns live queues and hides ticket data without registration_view', async () => {
    const { service, scope } = createService();
    const result = await service.live('00000000-0000-4000-8000-000000000001', {
      userId: '00000000-0000-4000-8000-000000000007',
      permissions: ['queue_view'],
    } as never);

    expect(scope.checkSiteAccess).toHaveBeenCalled();
    expect(result.totals).toMatchObject({
      waiting: 12,
      inProgress: 2,
      activeOperators: 1,
      longestWaitMinutes: 35,
    });
    expect(result.operators[0]).not.toHaveProperty('currentTicketNumber');
    expect(result.alerts[0]).toMatchObject({
      code: 'LONG_WAIT',
      severity: 'critical',
    });
  });
});
