import { ClockService } from '../clock/clock.service';
import { MonitoringRepository } from './monitoring.repository';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');

  function createService(databaseAvailable = true) {
    const repository = {
      isDatabaseAvailable: jest.fn().mockResolvedValue(databaseAvailable),
      activitySnapshot: jest.fn().mockResolvedValue({
        notifications: { failed: 2, pending: 3 },
        openOperatorSessions: 4,
        registrations: { waiting: 5 },
      }),
    } as unknown as MonitoringRepository;
    const clock = {
      now: jest.fn().mockReturnValue(now),
    } as unknown as ClockService;
    return {
      service: new MonitoringService(repository, clock),
      repository,
    };
  }

  it('keeps health limited to process and dependency health', async () => {
    const { service, repository } = createService();
    const result = await service.health();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(result).not.toHaveProperty('registrations');
    expect(repository.activitySnapshot).not.toHaveBeenCalled();
  });

  it('keeps metrics limited to technical counters', () => {
    const { service } = createService();
    service.increment('http_requests_total', 2);
    service.increment('http_request_duration_ms_total', 30);

    expect(service.metrics()).toEqual({
      counters: {
        http_requests_total: 2,
        http_request_duration_ms_total: 30,
      },
      derived: { averageHttpRequestDurationMs: 15 },
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
});
