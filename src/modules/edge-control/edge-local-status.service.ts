import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type PersistedDeploymentControl = {
  deploymentStatus?: 'active' | 'revoked' | 'unknown';
  lastStatusCheckedAt?: string | null;
  lastCloudSuccessAt?: string | null;
  lastCloudError?: string | null;
};

@Injectable()
export class EdgeLocalStatusService {
  constructor(private readonly database: DataSource) {}

  async getStatus() {
    const rows = (await this.database.query(
      `SELECT state_value
       FROM dorify_agent.agent_state
       WHERE state_key = 'deployment_control'`,
    )) as Array<{ state_value: string }>;
    const state = this.parse(rows[0]?.state_value);
    if (!state) return this.notConfigured();

    const cloudReachable =
      Boolean(state.lastCloudSuccessAt) && !state.lastCloudError;
    return {
      configured: true,
      deploymentStatus: state.deploymentStatus ?? 'unknown',
      cloudReachability: cloudReachable ? 'connected' : 'unreachable',
      lastCloudSuccessAt: state.lastCloudSuccessAt ?? null,
      lastCloudError:
        state.lastCloudError ??
        (cloudReachable ? null : 'Cloud status has not been checked yet'),
    };
  }

  private parse(value: string | undefined): PersistedDeploymentControl | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as PersistedDeploymentControl;
    } catch {
      return {
        deploymentStatus: 'unknown',
        lastCloudError: 'Stored deployment status is invalid',
      };
    }
  }

  private notConfigured() {
    return {
      configured: false,
      deploymentStatus: 'unknown' as const,
      cloudReachability: 'not_configured' as const,
      lastCloudSuccessAt: null,
      lastCloudError: null,
    };
  }
}
