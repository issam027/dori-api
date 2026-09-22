import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Rapport d'activité quotidien d'une file (§5.12)
   */
  async getQueueDailyReport(user: UserContext, queueId: number, dateStr?: string) {
    await this.scopeService.validateQueueScope(user, queueId);

    const queue = await this.prisma.queue.findUnique({
      where: { queueId },
      include: { site: true },
    });
    if (!queue) throw new AppException(ErrorCode.QUEUE_NOT_FOUND, { queueId });

    const businessDateStr = dateStr || this.clockService.getBusinessDate(queue.site.timezone);
    const businessDate = new Date(businessDateStr);

    const customers = await this.prisma.customer.findMany({
      where: {
        queueId,
        businessDate,
      },
      select: {
        customerId: true,
        status: true,
        entryType: true,
        calledAt: true,
        servedAt: true,
        priorityReferenceTime: true,
      },
    });

    const totalRegistrations = customers.length;
    const servedCount = customers.filter((c) => c.status === 'served').length;
    const noShowCount = customers.filter((c) => c.status === 'no_show').length;
    const waitingCount = customers.filter((c) => c.status === 'waiting').length;
    const expiredCount = customers.filter((c) => c.status === 'expired').length;

    const noShowRate = totalRegistrations > 0 ? Math.round((noShowCount / totalRegistrations) * 100) : 0;

    // Calcul du temps moyen d'attente effectif (entre priorityReferenceTime et calledAt)
    let totalWaitMinutes = 0;
    let countedServed = 0;

    customers.forEach((c) => {
      if (c.calledAt) {
        const wait = Math.max(0, Math.floor((c.calledAt.getTime() - c.priorityReferenceTime.getTime()) / (1000 * 60)));
        totalWaitMinutes += wait;
        countedServed++;
      }
    });

    const averageWaitTimeActual = countedServed > 0 ? Math.round(totalWaitMinutes / countedServed) : queue.averageWaitTime;

    return {
      queueId,
      queueCode: queue.queueCode,
      businessDate: businessDateStr,
      metrics: {
        totalRegistrations,
        servedCount,
        noShowCount,
        waitingCount,
        expiredCount,
        noShowRatePercent: noShowRate,
        averageWaitTimeActualMinutes: averageWaitTimeActual,
      },
    };
  }
}
