import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes.enum';

export interface UserContext {
  userId: number;
  roles: string[];
  permissions: string[];
  userType: string;
}

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie si l'utilisateur a un accès global système (root ou admin)
   */
  isSystemUser(user: UserContext): boolean {
    return user.roles.includes('root') || user.roles.includes('admin');
  }

  /**
   * Récupère les identifiants de sites autorisés pour l'utilisateur
   */
  async getAllowedSiteIds(user: UserContext): Promise<number[] | null> {
    if (this.isSystemUser(user)) {
      return null; // null = aucun filtre (tout autorisé)
    }

    if (user.roles.includes('manager')) {
      const userSites = await this.prisma.userSite.findMany({
        where: { userId: user.userId },
        select: { siteId: true },
      });
      return userSites.map((s) => s.siteId);
    }

    // hotesse ou kiosk : dérivé des queues assignées
    const userQueues = await this.prisma.userQueue.findMany({
      where: { userId: user.userId },
      include: { queue: { select: { siteId: true } } },
    });
    const siteIds = Array.from(new Set(userQueues.map((q) => q.queue.siteId)));
    return siteIds;
  }

  /**
   * Récupère les identifiants de queues autorisées pour l'utilisateur
   */
  async getAllowedQueueIds(user: UserContext): Promise<number[] | null> {
    if (this.isSystemUser(user)) {
      return null; // null = tout autorisé
    }

    if (user.roles.includes('manager')) {
      const siteIds = await this.getAllowedSiteIds(user);
      if (!siteIds || siteIds.length === 0) return [];
      const queues = await this.prisma.queue.findMany({
        where: { siteId: { in: siteIds }, isActive: true },
        select: { queueId: true },
      });
      return queues.map((q) => q.queueId);
    }

    // hotesse ou kiosk : uniquement les queues explicites (§4.10)
    const userQueues = await this.prisma.userQueue.findMany({
      where: { userId: user.userId },
      select: { queueId: true },
    });
    return userQueues.map((uq) => uq.queueId);
  }

  /**
   * Vérifie l'accès à un site spécifique.
   * Règle §4.11 : Hors périmètre = 404 (et non 403) pour ne pas révéler l'existence.
   */
  async validateSiteScope(user: UserContext, siteId: number): Promise<void> {
    if (this.isSystemUser(user)) return;

    const allowedSites = await this.getAllowedSiteIds(user);
    if (!allowedSites || !allowedSites.includes(siteId)) {
      throw new AppException(ErrorCode.SITE_NOT_FOUND, { siteId });
    }
  }

  /**
   * Vérifie l'accès à une file (queue) spécifique.
   * Règle §4.11 : Hors périmètre = 404.
   */
  async validateQueueScope(user: UserContext, queueId: number): Promise<void> {
    if (this.isSystemUser(user)) return;

    const allowedQueues = await this.getAllowedQueueIds(user);
    if (!allowedQueues || !allowedQueues.includes(queueId)) {
      throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });
    }
  }
}
