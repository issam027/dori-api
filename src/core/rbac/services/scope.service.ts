import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';
import { ScopeRepository } from '../repositories/scope.repository';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type Redis from 'ioredis';

export interface UserScope {
  isGlobal: boolean;
  siteIds: string[];
  queueIds: string[];
}
/** Préfixe de toutes les clés Redis du cache de scope RBAC */
const SCOPE_KEY_PREFIX = 'dori:scope:user:';
/** TTL du cache : 30 secondes (§7.5) */
const CACHE_TTL_SECONDS = 30;

@Injectable()
export class ScopeService {
  private readonly logger = new Logger(ScopeService.name);

  constructor(
    private readonly scopeRepository: ScopeRepository,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  private isRedisReady(): boolean {
    return Boolean(
      this.redis && (!this.redis.status || this.redis.status === 'ready'),
    );
  }

  private cacheKey(userId: string): string {
    return `${SCOPE_KEY_PREFIX}${userId}`;
  }

  async getUserScope(
    user: AuthenticatedUser,
    options: { fresh?: boolean } = {},
  ): Promise<UserScope> {
    // 1. Lecture depuis Redis si disponible
    if (!options.fresh && this.isRedisReady() && this.redis) {
      try {
        const cached = await this.redis.get(this.cacheKey(user.userId));
        if (cached) {
          return JSON.parse(cached) as UserScope;
        }
      } catch (err) {
        this.logger.debug(
          `Redis get scope error for user ${user.userId}: ${(err as Error).message}`,
        );
      }
    }

    // 2. Calcul du périmètre (scope) selon les rôles
    let scope: UserScope;

    if (user.roles?.includes('root') || user.roles?.includes('admin')) {
      scope = { isGlobal: true, siteIds: [], queueIds: [] };
    } else if (user.roles?.includes('manager')) {
      // Managers have access to their assigned sites and ALL queues of those sites (§4.10)
      const siteIds = await this.scopeRepository.findUserSiteIds(user.userId);
      const queueIds = await this.scopeRepository.findQueueIdsBySites(siteIds);
      scope = { isGlobal: false, siteIds, queueIds };
    } else {
      const queueScope = await this.scopeRepository.findUserQueueScope(
        user.userId,
      );
      const directSiteIds = await this.scopeRepository.findUserSiteIds(
        user.userId,
      );
      const siteIds = Array.from(
        new Set([...queueScope.siteIds, ...directSiteIds]),
      );
      scope = {
        isGlobal: false,
        siteIds,
        queueIds: queueScope.queueIds,
      };
    }

    // 3. SETEX : écriture dans Redis avec TTL de 30s (§7.5)
    if (!options.fresh && this.isRedisReady() && this.redis) {
      try {
        await this.redis.setex(
          this.cacheKey(user.userId),
          CACHE_TTL_SECONDS,
          JSON.stringify(scope),
        );
      } catch (err) {
        this.logger.debug(
          `Redis setex scope error for user ${user.userId}: ${(err as Error).message}`,
        );
      }
    }

    return scope;
  }

  async checkSiteAccess(
    user: AuthenticatedUser,
    siteId: string,
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
    queueId: string,
    options: { fresh?: boolean } = {},
  ): Promise<void> {
    const scope = await this.getUserScope(user, options);
    if (scope.isGlobal) return;

    if (!scope.queueIds.includes(queueId)) {
      // Return 404 QUEUE_NOT_FOUND per §4.11 & §6.2
      throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    }
  }

  async checkUserAccess(
    user: AuthenticatedUser,
    targetUserId: string,
  ): Promise<void> {
    const scope = await this.getUserScope(user, { fresh: true });
    if (scope.isGlobal || user.userId === targetUserId) return;
    if (
      !(await this.scopeRepository.userBelongsToSites(
        targetUserId,
        scope.siteIds,
      ))
    ) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
  }

  /** Invalide le scope d'un utilisateur sur TOUTES les instances (DEL Redis) */
  invalidateUserScope(userId: string): void {
    if (this.isRedisReady() && this.redis) {
      void this.redis.del(this.cacheKey(userId)).catch((err: Error) => {
        this.logger.debug(
          `Redis del scope error for user ${userId}: ${err.message}`,
        );
      });
    }
  }

  /** Invalide le cache de tous les utilisateurs (SCAN + DEL par batch) */
  async clearAllScopeCache(): Promise<void> {
    if (!this.isRedisReady() || !this.redis) return;
    try {
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
    } catch (err) {
      this.logger.debug(
        `Redis clearAllScopeCache error: ${(err as Error).message}`,
      );
    }
  }
}
