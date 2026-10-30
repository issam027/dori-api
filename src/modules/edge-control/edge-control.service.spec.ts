import { ClockService } from '../../core/clock/clock.service';
import { EdgeControlRepository } from './edge-control.repository';
import { EdgeControlService } from './edge-control.service';

describe('EdgeControlService', () => {
  const repository = {
    findInstallation: jest.fn(),
    updateHeartbeat: jest.fn(),
    listInstallations: jest.fn(),
    listCommands: jest.fn(),
    listRecentCommands: jest.fn(),
    createInstallation: jest.fn(),
    createCommand: jest.fn(),
    acknowledgeCommand: jest.fn(),
    completeCommand: jest.fn(),
    updateDeploymentStatus: jest.fn(),
  };
  const clock = { now: jest.fn(() => new Date('2026-10-30T08:00:00.000Z')) };
  const service = new EdgeControlService(
    repository as unknown as EdgeControlRepository,
    clock as unknown as ClockService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns an empty list when no installation is registered', async () => {
    repository.listInstallations.mockResolvedValue([]);
    await expect(service.listInstallations()).resolves.toEqual([]);
  });

  it('never stores the issued installation token in clear text', async () => {
    repository.createInstallation.mockResolvedValue({
      installation_id: '00000000-0000-4000-8000-000000000001',
      installation_name: 'Agence',
      last_seen_at: null,
      last_heartbeat: null,
      created_at: new Date('2026-10-30T08:00:00.000Z'),
    });
    const result = await service.createInstallation('Agence');
    const storedHash = repository.createInstallation.mock.calls[0][1] as string;
    expect(result.token).toHaveLength(101);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toContain(result.token);
  });

  it('rejects an invalid agent credential', async () => {
    repository.findInstallation.mockResolvedValue([
      { credential_status: 'active', token_hash: '0'.repeat(64) },
    ]);
    await expect(
      service.authenticate(
        '00000000-0000-4000-8000-000000000001',
        'Bearer invalid',
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a heartbeat whose body identity differs from its credential', async () => {
    await expect(
      service.heartbeat('00000000-0000-4000-8000-000000000001', {
        installationId: '00000000-0000-4000-8000-000000000002',
        sentAt: '2026-10-30T08:00:00.000Z',
        versions: { engine: '1', app: '1', agent: '1' },
        health: { agent: 'up', engine: 'ok' },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('returns the administrative status checked by the agent', async () => {
    repository.findInstallation.mockResolvedValue([
      { deployment_status: 'inactive' },
    ]);

    await expect(
      service.agentInstallationStatus('00000000-0000-4000-8000-000000000001'),
    ).resolves.toEqual({
      installationId: '00000000-0000-4000-8000-000000000001',
      deploymentStatus: 'inactive',
      checkedAt: '2026-10-30T08:00:00.000Z',
    });
  });
});
