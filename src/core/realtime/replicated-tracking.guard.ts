import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ReplicatedTrackingService } from './replicated-tracking.service';

@Injectable()
export class ReplicatedTrackingGuard implements CanActivate {
  constructor(private readonly tracking: ReplicatedTrackingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // Validate before Nest sends SSE headers for an async handler.
    await this.tracking.authorize(request.get('X-Registration-Token') ?? '');
    return true;
  }
}
