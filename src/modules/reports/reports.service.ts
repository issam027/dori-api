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
    const requestedQueueIds = query.queueIds
      ? [
          ...new Set(
            query.queueIds.split(',').map((item) => Number(item.trim())),
          ),
        ]
      : undefined;
    if (requestedQueueIds) {
      for (const queueId of requestedQueueIds) {
        await this.scopeService.checkQueueAccess(user, queueId);
      }
    } else {
      await this.scopeService.checkSiteAccess(user, query.siteId!);
    }
    const identities = await this.reportsRepository.findScopeIdentities({
      queueIds: requestedQueueIds,
      siteId: query.siteId,
    });
    if (
      requestedQueueIds &&
      identities.length !== new Set(requestedQueueIds).size
    ) {
      throw new DoriException('QUEUE_NOT_FOUND');
    }
    const queueIds = identities.map((item) => item.queue_id!);
    const rows = await this.reportsRepository.getSeries({
      queueIds,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      granularity: query.granularity,
      includeEmpty: query.includeEmpty,
      groupBy: query.groupBy,
    });
    const mapMetrics = (row: Record<string, unknown>) => {
      const value = (key: string) =>
        row[key] == null ? null : Number(row[key]);
      const registered = Number(row.registered ?? 0);
      const served = Number(row.served ?? 0);
      const noShow = Number(row.no_show ?? 0);
      const rate = (numerator: number, denominator: number) =>
        denominator === 0 ? null : Number((numerator / denominator).toFixed(4));
      return {
        volume: {
          registered,
          walkin: Number(row.walkin ?? 0),
          appointments: Number(row.appointments ?? 0),
          served,
          noShow,
          expired: Number(row.expired ?? 0),
          cancelled: Number(row.cancelled ?? 0),
        },
        timing: {
          averageWaitMinutes: value('avg_wait'),
          medianWaitMinutes: value('median_wait'),
          p90WaitMinutes: value('p90_wait'),
          averageServiceMinutes: value('avg_service'),
          medianServiceMinutes: value('median_service'),
          p90ServiceMinutes: value('p90_service'),
        },
        rates: {
          noShowRate: rate(noShow, served + noShow),
          cancellationRate: rate(Number(row.cancelled ?? 0), registered),
          expirationRate: rate(Number(row.expired ?? 0), registered),
        },
      };
    };
    const summaryRow = rows.find((row) => row.row_type === 'summary')!;
    const buckets = rows
      .filter((row) => row.row_type === 'bucket')
      .map((row) => ({
        periodStart: row.period_start,
        periodEnd: row.period_end,
        ...mapMetrics(row),
      }));
    const groupSummaries = rows.filter(
      (row) => row.row_type === 'group_summary',
    );
    const groups = query.groupBy
      ? groupSummaries.map((summary) => ({
          dimension: {
            type: query.groupBy,
            value: summary.group_key,
            label: summary.group_label,
          },
          timezone: summary.timezone,
          ...mapMetrics(summary),
          buckets: rows
            .filter(
              (row) =>
                row.row_type === 'group_bucket' &&
                row.group_key === summary.group_key,
            )
            .map((row) => ({
              periodStart: row.period_start,
              periodEnd: row.period_end,
              ...mapMetrics(row),
            })),
        }))
      : undefined;
    const timezones = new Set(identities.map((item) => item.timezone));
    const first = identities[0];
    const scope = query.queueIds
      ? { type: 'queues', queueIds }
      : { type: 'site', siteId: query.siteId, siteName: first?.site_name };
    return {
      scope,
      timezone: timezones.size === 1 ? (first?.timezone ?? null) : null,
      period: {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        granularity: query.granularity,
      },
      summary: mapMetrics(summaryRow),
      buckets,
      ...(groups ? { groups } : {}),
    };
  }
}
