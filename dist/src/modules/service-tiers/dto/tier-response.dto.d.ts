export declare class GlobalTierResponseDto {
    tierId: number;
    tierCode: string;
    tierName: string;
    description?: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class NotificationRuleResponseDto {
    ruleId: number;
    queueId: number;
    tierId: number;
    notificationType: string;
    channel: string;
    thresholdPosition?: number | null;
    thresholdMinutes?: number | null;
    includeTrackingLink: boolean;
    isActive: boolean;
}
export declare class QueueTierResponseDto {
    tierId: number;
    tierCode: string;
    tierName: string;
    isSystem: boolean;
    price: number;
    currency: string;
    displayOrder: number;
    notificationRules: NotificationRuleResponseDto[];
}
export declare class DisplayCurrentCallDto {
    threadNumber: number | null;
    ticketNumber: string;
}
export declare class QueueDisplayScreenResponseDto {
    queueId: number;
    queueCode: string;
    queueName?: string | null;
    currentCalls: DisplayCurrentCallDto[];
    nextTickets: string[];
}
