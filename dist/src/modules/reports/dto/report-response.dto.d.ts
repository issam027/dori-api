export declare class QueueDailyMetricsDto {
    totalRegistrations: number;
    servedCount: number;
    noShowCount: number;
    waitingCount: number;
    expiredCount: number;
    noShowRatePercent: number;
    averageWaitTimeActualMinutes: number;
}
export declare class QueueDailyReportResponseDto {
    queueId: number;
    queueCode: string;
    businessDate: string;
    metrics: QueueDailyMetricsDto;
}
