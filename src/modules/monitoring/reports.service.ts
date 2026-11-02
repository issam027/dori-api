import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ReportsRepository } from './reports.repository';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { ClockService } from '../../core/clock/clock.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  async getSeries(query: ReportSeriesQueryDto, user: AuthenticatedUser) {
    const csvValues = (value?: string) =>
      value
        ? [...new Set(value.split(',').map((item) => item.trim()))]
        : undefined;
    const requestedQueueIds = csvValues(query.queueIds);
    const requestedUserIds = csvValues(query.userIds);
    const tierIds = csvValues(query.tierIds);
    const statuses = csvValues(query.statuses);
    const entryTypes = csvValues(query.entryTypes);
    const from = this.clockService.parse(query.from);
    const to = this.clockService.parse(query.to);
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
      this.scopeService.assertSiteAccess(scope, query.siteId);
    }
    if (requestedQueueIds) {
      this.scopeService.assertQueuesAccess(scope, requestedQueueIds);
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
      medianWaitMinutes:
        row.median_wait_minutes == null
          ? null
          : Number(row.median_wait_minutes),
      p90WaitMinutes:
        row.p90_wait_minutes == null ? null : Number(row.p90_wait_minutes),
      averageServiceMinutes:
        row.average_service_minutes == null
          ? null
          : Number(row.average_service_minutes),
      medianServiceMinutes:
        row.median_service_minutes == null
          ? null
          : Number(row.median_service_minutes),
      p90ServiceMinutes:
        row.p90_service_minutes == null
          ? null
          : Number(row.p90_service_minutes),
    });
    const queueBuckets = new Map<string, Array<Record<string, unknown>>>();
    for (const bucket of data.byQueueSeries) {
      const key = String(bucket.queue_id);
      const rows = queueBuckets.get(key) ?? [];
      rows.push(bucket);
      queueBuckets.set(key, rows);
    }
    return {
      generatedAt: this.clockService.now().toISOString(),
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
          queueId: String(row.queue_id),
          queueName: row.queue_name,
          ...metric(row),
          series: (queueBuckets.get(String(row.queue_id)) ?? []).map(
            (bucket) => ({
              periodStart: bucket.period_start,
              ...metric(bucket),
            }),
          ),
        })),
        byUser: data.byUser.map((row) => ({
          userId: String(row.user_id),
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
          tierId: String(row.tier_id),
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
