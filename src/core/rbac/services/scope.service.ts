import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';
import { ScopeRepository } from '../repositories/scope.repository';

export interface UserScope {
  isGlobal: boolean;
  siteIds: number[];
  queueIds: number[];
}

@Injectable()
export class ScopeService {
  // In-memory cache with TTL 30s as per §7.5
  private scopeCache = new Map<
    number,
    { scope: UserScope; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 30 * 1000;

  constructor(private readonly scopeRepository: ScopeRepository) {}

  async getUserScope(user: AuthenticatedUser): Promise<UserScope> {
    if (user.roles?.includes('root') || user.roles?.includes('admin')) {
      return { isGlobal: true, siteIds: [], queueIds: [] };
    }

    const cached = this.scopeCache.get(user.userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.scope;
    }

    let siteIds: number[] = [];
    let queueIds: number[] = [];

    if (user.roles?.includes('manager')) {
      // Managers have access to their assigned sites and ALL queues of those sites (§4.10)
      siteIds = await this.scopeRepository.findUserSiteIds(user.userId);
      queueIds = await this.scopeRepository.findActiveQueueIdsBySites(siteIds);
    } else {
      const queueScope = await this.scopeRepository.findUserQueueScope(
        user.userId,
      );
      queueIds = queueScope.queueIds;
      const directSiteIds = await this.scopeRepository.findUserSiteIds(
        user.userId,
      );
      siteIds = Array.from(new Set([...queueScope.siteIds, ...directSiteIds]));
    }

    const scope: UserScope = {
      isGlobal: false,
      siteIds,
      queueIds,
    };

    this.scopeCache.set(user.userId, {
      scope,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return scope;
  }

  async checkSiteAccess(
    user: AuthenticatedUser,
    siteId: number,
  ): Promise<void> {
    const scope = await this.getUserScope(user);
    if (scope.isGlobal) return;

    if (!scope.siteIds.includes(siteId)) {
      // Return 404 SITE_NOT_FOUND per §4.11
      throw new DoriException('SITE_NOT_FOUND', { siteId });
    }
  }

  async checkQueueAccess(
    user: AuthenticatedUser,
    queueId: number,
  ): Promise<void> {
    const scope = await this.getUserScope(user);
    if (scope.isGlobal) return;

    if (!scope.queueIds.includes(queueId)) {
      // Return 404 QUEUE_NOT_FOUND per §4.11 & §6.2
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
  }

  invalidateUserScope(userId: number): void {
    this.scopeCache.delete(userId);
  }

  clearAllScopeCache(): void {
    this.scopeCache.clear();
  }
}
