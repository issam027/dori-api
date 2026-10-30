import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DoriException } from '../../core/errors/dori.exception';
import { EdgeLocalStatusService } from './edge-local-status.service';

const ALLOWED_WHEN_REVOKED = [
  '/api/v1/auth',
  '/api/v1/edge/local-status',
  '/api/v1/monitoring/health',
  '/api/edge/v1',
];

@Injectable()
export class EdgeDeploymentGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly localStatus: EdgeLocalStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<string>('deployment.mode') !== 'intra') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (ALLOWED_WHEN_REVOKED.some((prefix) => request.path.startsWith(prefix)))
      return true;

    const status = await this.localStatus.getStatus();
    if (status.deploymentStatus === 'revoked')
      throw new DoriException('INSTALLATION_REVOKED');
    return true;
  }
}
