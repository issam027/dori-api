import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../errors/dori.exception';

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

  constructor(private readonly dataSource: DataSource) {}

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
      const userSites = await this.dataSource.query(
        `SELECT site_id FROM dori_user_site WHERE user_id = $1`,
        [user.userId],
      );
      siteIds = userSites.map((r: any) => Number(r.site_id));

      if (siteIds.length > 0) {
        const queues = await this.dataSource.query(
          `SELECT queue_id FROM dori_site_queue_thread WHERE site_id = ANY($1) AND is_active = TRUE`,
          [siteIds],
        );
        queueIds = queues.map((r: any) => Number(r.queue_id));
      }
    } else {
      // Hotesse or Kiosk: only explicitly assigned queues in dori_user_queue (§4.10)
      const userQueues = await this.dataSource.query(
        `SELECT uq.queue_id, q.site_id
         FROM dori_user_queue uq
         JOIN dori_site_queue_thread q ON q.queue_id = uq.queue_id
         WHERE uq.user_id = $1 AND q.is_active = TRUE`,
        [user.userId],
      );
      queueIds = userQueues.map((r: any) => Number(r.queue_id));
      siteIds = Array.from(
        new Set(userQueues.map((r: any) => Number(r.site_id))),
      );
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
