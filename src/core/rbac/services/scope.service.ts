import { Injectable, Inject } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';
import { ScopeRepository } from '../repositories/scope.repository';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type Redis from 'ioredis';

export interface UserScope {
  isGlobal: boolean;
  siteIds: number[];
  queueIds: number[];
}

/** Préfixe de toutes les clés Redis du cache de scope RBAC */
const SCOPE_KEY_PREFIX = 'scope:user:';
/** TTL du cache : 30 secondes (§7.5) */
const CACHE_TTL_SECONDS = 30;

@Injectable()
export class ScopeService {
  constructor(
    private readonly scopeRepository: ScopeRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private cacheKey(userId: number): string {
    return `${SCOPE_KEY_PREFIX}${userId}`;
  }

  async getUserScope(user: AuthenticatedUser): Promise<UserScope> {
    if (user.roles?.includes('root') || user.roles?.includes('admin')) {
      return { isGlobal: true, siteIds: [], queueIds: [] };
    }

    // Lecture depuis Redis (partagé entre toutes les instances)
    const cached = await this.redis.get(this.cacheKey(user.userId));
    if (cached) {
      return JSON.parse(cached) as UserScope;
    }

    let siteIds: number[] = [];
    let queueIds: number[] = [];

    if (user.roles?.includes('manager')) {
      // Managers have access to their assigned sites and ALL queues of those sites (§4.10)
      siteIds = await this.scopeRepository.findUserSiteIds(user.userId);
      queueIds = await this.scopeRepository.findQueueIdsBySites(siteIds);
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

    // SETEX : écriture avec TTL, visible par toutes les instances (§7.5)
    await this.redis.setex(
      this.cacheKey(user.userId),
      CACHE_TTL_SECONDS,
      JSON.stringify(scope),
    );

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

  /** Invalide le scope d'un utilisateur sur TOUTES les instances (DEL Redis) */
  invalidateUserScope(userId: number): void {
    // Fire-and-forget : pas besoin d'awaiter, l'invalidation est quasi-instantanée
    void this.redis.del(this.cacheKey(userId));
  }

  /** Invalide le cache de tous les utilisateurs (SCAN + DEL par batch) */
  async clearAllScopeCache(): Promise<void> {
    let cursor = '0';
    const pattern = `${SCOPE_KEY_PREFIX}*`;
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
