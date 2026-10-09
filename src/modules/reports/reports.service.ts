import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ReportScope, ReportsRepository } from './reports.repository';

const EMPTY_SUMMARY = {
  activeSites: 0,
  activeQueues: 0,
  waitingTotal: 0,
  waitingWalkin: 0,
  waitingAppointment: 0,
  appointmentsToday: 0,
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly scopeService: ScopeService,
  ) {}

  async getDailyQueueReport(
    queueId: number,
    date: string,
    user: AuthenticatedUser,
  ) {
    await this.scopeService.checkQueueAccess(user, queueId);
    const queue = await this.reportsRepository.findQueueIdentity(queueId);
    if (!queue) throw new DoriException('QUEUE_NOT_FOUND', { queueId });
    const row = await this.reportsRepository.getDailyStats(queueId, date);
    const totalServed = row.total_served || 0;
    const totalNoShow = row.total_no_show || 0;
    const handledTotal = totalServed + totalNoShow;
    return {
      queueId,
      queueCode: queue.queue_code,
      queueName: queue.queue_name,
      siteName: queue.site_name,
      businessDate: date,
      volume: {
        totalRegistered: row.total_registered || 0,
        totalWalkin: row.total_walkin || 0,
        totalAppointment: row.total_appointment || 0,
        totalServed,
        totalNoShow,
        totalExpired: row.total_expired || 0,
        totalCancelled: row.total_cancelled || 0,
        totalOpen:
          row.total_registered -
          row.total_expired -
          row.total_cancelled -
          handledTotal,
      },
      kpis: {
        noShowRate:
          handledTotal > 0
            ? Number((totalNoShow / handledTotal).toFixed(3))
            : 0,
        averageWaitMinutes: Number(row.avg_wait_minutes || 0),
        averageServiceMinutes: Number(row.avg_service_minutes || 0),
      },
    };
  }

  async getDashboardSummary(siteId?: number, user?: AuthenticatedUser) {
    const scope = await this.resolveScope(siteId, user);
    if (!scope) return EMPTY_SUMMARY;
    const row = await this.reportsRepository.getDashboardSummary(scope);
    return {
      activeSites: row.active_sites || 0,
      activeQueues: row.active_queues || 0,
      waitingTotal: row.waiting_total || 0,
      waitingWalkin: row.waiting_walkin || 0,
      waitingAppointment: row.waiting_appointment || 0,
      appointmentsToday: row.appointments_today || 0,
    };
  }

  async getDashboardQueueLoad(
    limit = 4,
    siteId?: number,
    user?: AuthenticatedUser,
  ) {
    const scope = await this.resolveScope(siteId, user);
    if (!scope) return [];
    return this.reportsRepository.getDashboardQueueLoad(scope, limit);
  }

  private async resolveScope(
    siteId?: number,
    user?: AuthenticatedUser,
  ): Promise<ReportScope | null> {
    if (siteId !== undefined) {
      if (user) await this.scopeService.checkSiteAccess(user, siteId);
      return { siteId };
    }
    if (!user) return {};
    const scope = await this.scopeService.getUserScope(user);
    if (scope.isGlobal) return {};
    if (scope.siteIds.length) return { siteIds: scope.siteIds };
    if (scope.queueIds.length) return { queueIds: scope.queueIds };
    return null;
  }
}
