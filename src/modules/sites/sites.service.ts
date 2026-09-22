import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { CreateSiteDto, UpdateSiteDto } from './dto/site.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findAll(user: UserContext, pagination: PaginationQueryDto) {
    const allowedSiteIds = await this.scopeService.getAllowedSiteIds(user);
    const whereClause: any = { isActive: true };

    if (allowedSiteIds !== null) {
      whereClause.siteId = { in: allowedSiteIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.site.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { siteName: 'asc' },
      }),
      this.prisma.site.count({ where: whereClause }),
    ]);

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findById(user: UserContext, siteId: number) {
    await this.scopeService.validateSiteScope(user, siteId);

    const site = await this.prisma.site.findFirst({
      where: { siteId, isActive: true },
    });

    if (!site) {
      throw new AppException(ErrorCode.SITE_NOT_FOUND, { siteId });
    }

    return site;
  }

  async create(dto: CreateSiteDto) {
    return this.prisma.site.create({
      data: dto,
    });
  }

  async update(user: UserContext, siteId: number, dto: UpdateSiteDto) {
    await this.scopeService.validateSiteScope(user, siteId);

    return this.prisma.site.update({
      where: { siteId },
      data: dto,
    });
  }

  /**
   * Soft delete du site et propagation applicative aux queues associées (§3.1, §5.3, §8.1)
   */
  async delete(user: UserContext, siteId: number) {
    await this.scopeService.validateSiteScope(user, siteId);
    const now = this.clockService.now();

    return this.prisma.$transaction(async (tx) => {
      // 1. Désactivation des queues associées
      await tx.queue.updateMany({
        where: { siteId, isActive: true },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });

      // 2. Désactivation du site
      return tx.site.update({
        where: { siteId },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });
    });
  }

  async getManagers(user: UserContext, siteId: number) {
    await this.scopeService.validateSiteScope(user, siteId);

    const userSites = await this.prisma.userSite.findMany({
      where: { siteId },
      include: {
        user: {
          select: {
            userId: true,
            username: true,
            email: true,
            userType: true,
          },
        },
      },
    });

    return userSites.map((us) => us.user);
  }

  async assignManager(user: UserContext, siteId: number, targetUserId: number) {
    await this.scopeService.validateSiteScope(user, siteId);

    return this.prisma.userSite.upsert({
      where: { userId_siteId: { userId: targetUserId, siteId } },
      update: {},
      create: { userId: targetUserId, siteId },
    });
  }

  async unassignManager(user: UserContext, siteId: number, targetUserId: number) {
    await this.scopeService.validateSiteScope(user, siteId);

    await this.prisma.userSite.deleteMany({
      where: { userId: targetUserId, siteId },
    });

    return { success: true };
  }
}
