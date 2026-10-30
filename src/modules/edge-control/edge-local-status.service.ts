import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LocalAgentHealth = {
  agent?: {
    enabled?: boolean;
    deploymentStatus?: 'active' | 'inactive' | 'unknown';
    lastCloudSuccessAt?: string | null;
    lastCloudError?: string | null;
  };
};

@Injectable()
export class EdgeLocalStatusService {
  constructor(private readonly config: ConfigService) {}

  async getStatus() {
    const agentUrl = this.config.get<string>('edge.agentUrl');
    if (!agentUrl) return this.notConfigured();

    try {
      const response = await fetch(`${agentUrl}/healthz`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok)
        return this.unreachable(`Agent returned HTTP ${response.status}`);
      const health = (await response.json()) as LocalAgentHealth;
      if (!health.agent?.enabled) return this.notConfigured();
      const cloudReachable =
        Boolean(health.agent.lastCloudSuccessAt) &&
        !health.agent.lastCloudError;
      return {
        configured: true,
        deploymentStatus: health.agent.deploymentStatus ?? 'unknown',
        cloudReachability: cloudReachable ? 'connected' : 'unreachable',
        lastCloudSuccessAt: health.agent.lastCloudSuccessAt ?? null,
        lastCloudError:
          health.agent.lastCloudError ??
          (cloudReachable ? null : 'Cloud status has not been checked yet'),
      };
    } catch (error) {
      return this.unreachable(
        error instanceof Error ? error.message : 'Agent is unreachable',
      );
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

  private unreachable(error: string) {
    return {
      configured: true,
      deploymentStatus: 'unknown' as const,
      cloudReachability: 'unreachable' as const,
      lastCloudSuccessAt: null,
      lastCloudError: error,
    };
  }
}
