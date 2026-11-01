import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { JwtSessionRepository } from '../auth/repositories/jwt-session.repository';
import { ClockService } from '../clock/clock.service';
import { DoriException } from '../errors/dori.exception';
import { ScopeService } from '../rbac/services/scope.service';
import { RealtimeRepository } from './realtime.repository';

@Injectable()
export class RealtimeAuthorizationService {
  constructor(
    private readonly sessions: JwtSessionRepository,
    private readonly scope: ScopeService,
    private readonly clock: ClockService,
    private readonly repository: RealtimeRepository,
  ) {}

  async verifySession(user: AuthenticatedUser): Promise<void> {
    if (
      !user.sessionId ||
      !user.accessTokenExpiresAt ||
      user.accessTokenExpiresAt * 1000 <= this.clock.now().getTime()
    )
      throw new DoriException('UNAUTHENTICATED');
    if (
      !(await this.sessions.findValidSessionId(
        user.sessionId,
        user.userId,
        this.clock.now(),
      ))
    )
      throw new DoriException('UNAUTHENTICATED');
  }

  async verifyDisplay(user: AuthenticatedUser, queueId: string): Promise<void> {
    await this.verifySession(user);
    await this.scope.checkQueueAccess(user, queueId, { fresh: true });
  }

  async verifyTracking(queueId: string, token: string): Promise<Date> {
    if (!token) throw new DoriException('UNAUTHENTICATED');
    const current =
      await this.repository.findRegistrationByTrackingToken(token);
    if (
      !current ||
      !current.is_active ||
      current.queue_id !== queueId ||
      this.clock.parse(current.registration_tracking_token_valid_until) <=
        this.clock.now()
    )
      throw new DoriException('TOKEN_EXPIRED');
    return this.clock.parse(current.registration_tracking_token_valid_until);
  }
}
