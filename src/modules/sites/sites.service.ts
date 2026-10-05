import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import {
  PaginatedResult,
  PaginationDto,
} from '../../core/pagination/pagination.dto';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { CreateSiteDto } from './dto/create-site.dto';
import {
  SiteDetailResponseDto,
  SiteManagerDetailDto,
} from './dto/site-response.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesRepository } from './sites.repository';

@Injectable()
export class SitesService {
  constructor(
    private readonly sitesRepository: SitesRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async findSites(
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteDetailResponseDto>> {
    const scope = await this.scopeService.getUserScope(user);
    if (!scope.isGlobal && scope.siteIds.length === 0) {
      return pagination.createResponse([], 0);
    }
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['site_id', 'site_name', 'site_type', 'created_at', 'updated_at'],
      'created_at',
    );
    const { items, total } = await this.sitesRepository.findActive(
      scope.isGlobal ? null : scope.siteIds,
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

  async findSiteById(siteId: number, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findActiveById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    return site;
  }

  async updateSite(
    siteId: number,
    dto: UpdateSiteDto,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findActiveById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    return this.sitesRepository.update(
      siteId,
      dto,
      user.userId,
      this.clockService.now(),
    );
  }

  async deleteSite(siteId: number, user: AuthenticatedUser) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const site = await this.sitesRepository.findActiveById(siteId);
    if (!site) throw new DoriException('SITE_NOT_FOUND', { siteId });
    await this.sitesRepository.deactivate(
      siteId,
      user.userId,
      this.clockService.now(),
    );
    return { siteId, deleted: true };
  }

  async findSiteManagers(
    siteId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteManagerDetailDto>> {
    await this.scopeService.checkSiteAccess(user, siteId);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['u.user_id', 'u.username', 'u.email', 'us.assigned_at'],
      'us.assigned_at',
    );
    const { items, total } = await this.sitesRepository.findManagers(
      siteId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    );
    return pagination.createResponse(items, total);
  }

  getSiteManagers(
    siteId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<SiteManagerDetailDto>> {
    const isUser = paginationOrUser && 'userId' in paginationOrUser;
    return this.findSiteManagers(
      siteId,
      isUser ? new PaginationDto() : paginationOrUser || new PaginationDto(),
      (isUser ? paginationOrUser : maybeUser) as AuthenticatedUser,
    );
  }

  async assignSiteManager(
    siteId: number,
    targetUserId: number,
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
    if (!(await this.sitesRepository.hasActiveManagerRole(targetUserId))) {
      throw new DoriException('FORBIDDEN_ROLE_ESCALATION');
    }
    await this.sitesRepository.assignManager(
      siteId,
      targetUserId,
      user.userId,
      this.clockService.now(),
    );
    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, assigned: true };
  }

  assignManager(siteId: number, targetUserId: number, user: AuthenticatedUser) {
    return this.assignSiteManager(siteId, targetUserId, user);
  }

  async removeSiteManager(
    siteId: number,
    targetUserId: number,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    await this.sitesRepository.removeManager(siteId, targetUserId);
    this.scopeService.invalidateUserScope(targetUserId);
    return { siteId, userId: targetUserId, removed: true };
  }

  removeManager(siteId: number, targetUserId: number, user: AuthenticatedUser) {
    return this.removeSiteManager(siteId, targetUserId, user);
  }
}
