import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EdgeDeploymentGuard } from './edge-deployment.guard';
import { EdgeLocalStatusService } from './edge-local-status.service';

function context(path: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path }) }),
  } as unknown as ExecutionContext;
}

describe('EdgeDeploymentGuard', () => {
  const config = { get: jest.fn(() => 'intra') };
  const localStatus = { getStatus: jest.fn() };
  const guard = new EdgeDeploymentGuard(
    config as unknown as ConfigService,
    localStatus as unknown as EdgeLocalStatusService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('blocks business endpoints when the persisted status is revoked', async () => {
    localStatus.getStatus.mockResolvedValue({ deploymentStatus: 'revoked' });
    await expect(
      guard.canActivate(context('/api/v1/sites')),
    ).rejects.toMatchObject({ status: 403, code: 'INSTALLATION_REVOKED' });
  });

  it('keeps local status accessible so the UI can explain the revocation', async () => {
    await expect(
      guard.canActivate(context('/api/v1/edge/local-status')),
    ).resolves.toBe(true);
    expect(localStatus.getStatus).not.toHaveBeenCalled();
  });

  it('allows business endpoints when active but cloud is unreachable', async () => {
    localStatus.getStatus.mockResolvedValue({
      deploymentStatus: 'active',
      cloudReachability: 'unreachable',
    });
    await expect(guard.canActivate(context('/api/v1/sites'))).resolves.toBe(
      true,
    );
  });
});
