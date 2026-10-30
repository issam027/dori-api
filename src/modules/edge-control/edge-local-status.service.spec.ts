import { DataSource } from 'typeorm';
import { EdgeLocalStatusService } from './edge-local-status.service';

describe('EdgeLocalStatusService', () => {
  const database = { query: jest.fn() };
  const service = new EdgeLocalStatusService(database as unknown as DataSource);

  beforeEach(() => jest.clearAllMocks());

  it('preserves a revoked last-known status during a cloud outage', async () => {
    database.query.mockResolvedValue([
      {
        state_value: JSON.stringify({
          deploymentStatus: 'revoked',
          lastCloudSuccessAt: '2026-10-30T08:00:00.000Z',
          lastCloudError: 'offline',
        }),
      },
    ]);

    await expect(service.getStatus()).resolves.toEqual({
      configured: true,
      deploymentStatus: 'revoked',
      cloudReachability: 'unreachable',
      lastCloudSuccessAt: '2026-10-30T08:00:00.000Z',
      lastCloudError: 'offline',
    });
  });

  it('allows an active last-known status while reporting cloud unavailability', async () => {
    database.query.mockResolvedValue([
      {
        state_value: JSON.stringify({
          deploymentStatus: 'active',
          lastCloudSuccessAt: '2026-10-30T08:00:00.000Z',
          lastCloudError: 'offline',
        }),
      },
    ]);

    await expect(service.getStatus()).resolves.toMatchObject({
      deploymentStatus: 'active',
      cloudReachability: 'unreachable',
    });
  });
});
