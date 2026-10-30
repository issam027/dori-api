import { ConfigService } from '@nestjs/config';
import { EdgeLocalStatusService } from './edge-local-status.service';

describe('EdgeLocalStatusService', () => {
  const config = {
    get: jest.fn(() => 'http://agent:3100'),
  } as unknown as ConfigService;
  const service = new EdgeLocalStatusService(config);

  afterEach(() => jest.restoreAllMocks());

  it('reports cloud unavailability without throwing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(service.getStatus()).resolves.toEqual({
      configured: true,
      deploymentStatus: 'unknown',
      cloudReachability: 'unreachable',
      lastCloudSuccessAt: null,
      lastCloudError: 'offline',
    });
  });

  it('forwards the inactive state reported by the agent', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          agent: {
            enabled: true,
            deploymentStatus: 'inactive',
            lastCloudSuccessAt: '2026-10-30T08:00:00.000Z',
            lastCloudError: null,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(service.getStatus()).resolves.toMatchObject({
      configured: true,
      deploymentStatus: 'inactive',
      cloudReachability: 'connected',
    });
  });
});
