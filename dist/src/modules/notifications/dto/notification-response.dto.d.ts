export declare class NotificationCustomerSummaryDto {
    ticketNumber: string;
    queueId: number;
}
export declare class NotificationResponseDto {
    notificationId: number;
    customerId: number;
    channel: string;
    recipient: string;
    payload: string;
    notificationStatus: string;
    attemptCount: number;
    failureReason?: string | null;
    providerMessageId?: string | null;
    customer?: NotificationCustomerSummaryDto;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    createdAt: Date;
}
