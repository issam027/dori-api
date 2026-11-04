import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { ScopeService } from '../../core/rbac/services/scope.service';
import {
  CreateAnnouncementDto,
  AnnouncementQueryDto,
  AnnouncementScope,
} from './dto/announcement.dto';
import { AnnouncementsRepository } from './announcements.repository';
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly repository: AnnouncementsRepository,
    private readonly clock: ClockService,
    private readonly config: ConfigService,
    private readonly scope: ScopeService,
  ) {}
  private async access(
    type: AnnouncementScope,
    user: AuthenticatedUser,
  ): Promise<string[] | undefined> {
    const root = user.roles.includes('root');
    if (type === 'installations') {
      if (
        this.config.get<string>('deployment.mode') !== 'cloud' ||
        (!root && !user.permissions.includes('edge_installation_manage'))
      )
        throw new DoriException('FORBIDDEN_PERMISSION');
      return undefined;
    }
    if (!root && !user.permissions.includes('site_edit'))
      throw new DoriException('FORBIDDEN_PERMISSION');
    const scope = await this.scope.getUserScope(user, { fresh: true });
    return scope.isGlobal ? undefined : scope.siteIds;
  }
  async list(query: AnnouncementQueryDto, user: AuthenticatedUser) {
    const allowed = await this.access(query.scope, user);
    return this.repository.list(
      query.scope,
      query.page,
      query.pageSize,
      this.clock.now(),
      allowed,
    );
  }
  async create(body: CreateAnnouncementDto, user: AuthenticatedUser) {
    const allowed = await this.access(body.scope, user);
    if (allowed && body.targetIds.some((id) => !allowed.includes(id)))
      throw new DoriException('RESOURCE_NOT_FOUND');
    const now = this.clock.now(),
      startsAt = body.startsAt ? this.clock.parse(body.startsAt) : now,
      endsAt = this.clock.parse(body.endsAt);
    if (
      endsAt <= now ||
      endsAt <= startsAt ||
      endsAt.getTime() - startsAt.getTime() > 30 * 86400000 ||
      startsAt.getTime() - now.getTime() > 90 * 86400000
    )
      throw new DoriException('VALIDATION_ERROR', {
        errors: [
          'The announcement period must be in the future, last at most 30 days and start within 90 days.',
        ],
      });
    return this.repository.create(body, user.userId, startsAt, endsAt, now);
  }
  async withdraw(id: string, user: AuthenticatedUser) {
    const record = await this.repository.find(id, this.clock.now());
    if (!record) throw new DoriException('RESOURCE_NOT_FOUND');
    const allowed = await this.access(record.scope, user);
    if (
      allowed &&
      record.targets.some((target) => !allowed.includes(target.targetId))
    )
      throw new DoriException('RESOURCE_NOT_FOUND');
    if (!(await this.repository.withdraw(id, this.clock.now())))
      throw new DoriException('RESOURCE_NOT_FOUND');
    return { announcementId: id };
  }
}
