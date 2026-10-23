import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginatedResult } from '../../core/pagination/pagination.dto';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { CreateSiteDto } from './dto/create-site.dto';
import {
  SiteResponseDto,
  SiteDirectUserResponseDto,
} from './dto/site-response.dto';
import {
  DirectSiteUserFilterDto,
  SiteFilterDto,
  UpdateSiteDto,
} from './dto/update-site.dto';
import { SitesRepository } from './sites.repository';

@Injectable()
export class SitesService {
  constructor(
    private readonly sitesRepository: SitesRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findSites(
    pagination: SiteFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteResponseDto>> {
    const scope = await this.scopeService.getUserScope(user);
    if (!scope.isGlobal && scope.siteIds.length === 0) {
      return pagination.createResponse([], 0);
    }
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['site_id', 'site_name', 'site_type', 'created_at', 'updated_at'],
      'created_at',
    );
    const { items, total } = await this.sitesRepository.findPage(
      scope.isGlobal ? null : scope.siteIds,
      pagination.isActive,
      sortField,
      sortOrder,
      pageSize,
      offset,
    );
    return pagination.createResponse(items, total);
  }

  createSite(dto: CreateSiteDto, user: AuthenticatedUser) {
    return this.sitesRepository.create(
      dto,
      user.userId,
      this.clockService.now(),
    );
  }

  async findSiteById(siteId: string, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    return site;
  }

  async updateSite(
    siteId: string,
    dto: UpdateSiteDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    return this.sitesRepository.update(
      siteId,
      dto,
      user.userId,
      this.clockService.now(),
    );
  }

  async deleteSite(siteId: string, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    await this.sitesRepository.deactivate(
      siteId,
      user.userId,
      this.clockService.now(),
    );
    await this.scopeService.clearAllScopeCache();
    return { siteId, deleted: true };
  }

  async findDirectSiteUsers(
    siteId: string,
    pagination: DirectSiteUserFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteDirectUserResponseDto>> {
    await this.scopeService.checkSiteAccess(user, siteId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['u.user_id', 'u.username', 'u.email', 'us.assigned_at'],
      'us.assigned_at',
    );
    const { items, total } = await this.sitesRepository.findDirectSiteUsers(
      siteId,
      sortField,
      sortOrder,
      pageSize,
      offset,
      pagination.role,
    );
    return pagination.createResponse(items, total);
  }

  async assignDirectSiteUser(
    siteId: string,
    targetUserId: string,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const target = await this.sitesRepository.findUserStatus(targetUserId);
    if (!target) {
      throw new DoriException('USER_NOT_FOUND', { userId: targetUserId });
    }
    if (!target.is_active) {
      throw new DoriException('ACCOUNT_LOCKED', { userId: targetUserId });
    }
    if (!(await this.sitesRepository.hasActiveDirectSiteRole(targetUserId))) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }
    await this.sitesRepository.assignDirectSiteUser(
      siteId,
      targetUserId,
      user.userId,
      this.clockService.now(),
    );
    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, assigned: true };
  }

  async removeDirectSiteUser(
    siteId: string,
    targetUserId: string,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    await this.sitesRepository.removeDirectSiteUser(siteId, targetUserId);
    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, removed: true };
  }
}
