import { DataSource } from 'typeorm';
import { MonitoringRepository } from './monitoring.repository';

describe('MonitoringRepository live snapshot', () => {
  it('loads a site, all queue aggregates and operators with three fixed queries', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          site_id: '00000000-0000-4000-8000-000000000001',
          timezone: 'Europe/Paris',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = new MonitoringRepository({
      query,
    } as unknown as DataSource);

    await repository.liveSnapshot('00000000-0000-4000-8000-000000000001');

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][0]).toContain(
      "r.status IN ('waiting','in_progress')",
    );
    expect(query.mock.calls[2][0]).toContain('os.disconnected_at IS NULL');
  });
});

describe('MonitoringRepository platform activity', () => {
  it('limits the snapshot to actionable notifications and open registrations', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new MonitoringRepository({
      query,
    } as unknown as DataSource);

    await repository.activitySnapshot();

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain(
      "notification_status IN ('pending', 'processing')",
    );
    expect(query.mock.calls[0][0]).toContain("interval '24 hours'");
    expect(query.mock.calls[2][0]).toContain(
      "status IN ('booked', 'waiting', 'in_progress')",
    );
  });
});
