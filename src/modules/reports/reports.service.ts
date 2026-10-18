import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ReportsRepository } from './reports.repository';
import { ReportSeriesQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly scopeService: ScopeService,
  ) {}

  async getSeries(query: ReportSeriesQueryDto, user: AuthenticatedUser) {
    const csvNumbers = (value?: string) =>
      value
        ? [...new Set(value.split(',').map((item) => Number(item.trim())))]
        : undefined;
    const csvStrings = (value?: string) =>
      value
        ? [...new Set(value.split(',').map((item) => item.trim()))]
        : undefined;
    const requestedQueueIds = csvNumbers(query.queueIds);
    const requestedUserIds = csvNumbers(query.userIds);
    const tierIds = csvNumbers(query.tierIds);
    const statuses = csvStrings(query.statuses);
    const entryTypes = csvStrings(query.entryTypes);
    const from = new Date(query.from);
    const to = new Date(query.to);
    const maxDays = query.bucket === 'hour' ? 31 : 366;
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from >= to ||
      to.getTime() - from.getTime() > maxDays * 86_400_000
    ) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: [`from/to must define at most ${maxDays} days`] },
      );
    }
    const scope = await this.scopeService.getUserScope(user);
    if (query.siteId !== undefined) {
      await this.scopeService.checkSiteAccess(user, query.siteId);
    }
    if (requestedQueueIds) {
      for (const queueId of requestedQueueIds) {
        await this.scopeService.checkQueueAccess(user, queueId);
      }
    }
    if (!query.siteId && !requestedQueueIds && scope.isGlobal) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        { errors: ['siteId or queueIds is required for a global account'] },
      );
    }
    const identities = await this.reportsRepository.findScopeIdentities({
      queueIds:
        requestedQueueIds ?? (scope.isGlobal ? undefined : scope.queueIds),
      siteId: query.siteId,
    });
    if (
      requestedQueueIds &&
      identities.length !== new Set(requestedQueueIds).size
    ) {
      throw new DoriException('QUEUE_NOT_FOUND');
    }
    const queueIds = identities.map((item) => item.queue_id!);
    if (queueIds.length === 0) {
      throw new DoriException('QUEUE_NOT_FOUND');
    }
    const canSuperviseUsers = user.roles?.some((role) =>
      ['root', 'admin', 'manager'].includes(role),
    );
    const userIds = canSuperviseUsers
      ? requestedUserIds
      : requestedUserIds?.includes(user.userId) === false
        ? (() => {
            throw new DoriException('USER_NOT_FOUND');
          })()
        : [user.userId];
    const identityTimezones = new Set(identities.map((item) => item.timezone));
    const timezone =
      query.timezone ??
      (identityTimezones.size === 1 ? identities[0].timezone : undefined);
    if (!timezone) {
      throw new DoriException(
        'VALIDATION_ERROR',
        {},
        {
          errors: ['timezone is required when queues span multiple timezones'],
        },
      );
    }
    const data = await this.reportsRepository.getMonitoringSeries({
      queueIds,
      userIds,
      tierIds,
      statuses,
      entryTypes,
      from: query.from,
      to: query.to,
      bucket: query.bucket,
      timezone,
    });
    const metric = (row: Record<string, unknown>) => ({
      registered: Number(row.registered ?? 0),
      served: Number(row.served ?? 0),
      noShow: Number(row.no_show ?? 0),
      cancelled: Number(row.cancelled ?? 0),
      averageWaitMinutes:
        row.average_wait_minutes == null
          ? null
          : Number(row.average_wait_minutes),
      averageServiceMinutes:
        row.average_service_minutes == null
          ? null
          : Number(row.average_service_minutes),
    });
    return {
      generatedAt: new Date().toISOString(),
      timezone,
      appliedFilters: {
        from: query.from,
        to: query.to,
        bucket: query.bucket,
        ...(query.siteId ? { siteId: query.siteId } : {}),
        ...(requestedQueueIds ? { queueIds: requestedQueueIds } : {}),
        ...(userIds ? { userIds } : {}),
        ...(tierIds ? { tierIds } : {}),
        ...(statuses ? { statuses } : {}),
        ...(entryTypes ? { entryTypes } : {}),
      },
      totals: metric(data.totals),
      series: data.series.map((row) => ({
        periodStart: row.period_start,
        ...metric(row),
      })),
      breakdowns: {
        byQueue: data.byQueue.map((row) => ({
          queueId: Number(row.queue_id),
          queueName: row.queue_name,
          ...metric(row),
        })),
        byUser: data.byUser.map((row) => ({
          userId: Number(row.user_id),
          displayName: row.display_name,
          registered: Number(row.registered ?? 0),
          served: Number(row.served ?? 0),
          noShow: Number(row.no_show ?? 0),
          averageServiceMinutes:
            row.average_service_minutes == null
              ? null
              : Number(row.average_service_minutes),
        })),
        byTier: data.byTier.map((row) => ({
          tierId: Number(row.tier_id),
          tierCode: row.tier_code,
          tierName: row.tier_name,
          registered: Number(row.registered ?? 0),
          served: Number(row.served ?? 0),
          noShow: Number(row.no_show ?? 0),
          averageWaitMinutes:
            row.average_wait_minutes == null
              ? null
              : Number(row.average_wait_minutes),
        })),
        byEntryType: data.byEntryType.map((row) => ({
          entryType: row.entry_type,
          count: Number(row.count),
        })),
        byStatus: data.byStatus.map((row) => ({
          status: row.status,
          count: Number(row.count),
        })),
      },
    };
  }
}
