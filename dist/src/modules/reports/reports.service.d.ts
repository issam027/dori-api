import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
export declare class ReportsService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    getQueueDailyReport(user: UserContext, queueId: number, dateStr?: string): Promise<{
        queueId: number;
        queueCode: string;
        businessDate: string;
        metrics: {
            totalRegistrations: number;
            servedCount: number;
            noShowCount: number;
            waitingCount: number;
            expiredCount: number;
            noShowRatePercent: number;
            averageWaitTimeActualMinutes: number;
        };
    }>;
}
