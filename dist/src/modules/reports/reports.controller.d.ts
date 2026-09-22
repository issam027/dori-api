import { ReportsService } from './reports.service';
import { UserContext } from '../../core/rbac/scope.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
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
