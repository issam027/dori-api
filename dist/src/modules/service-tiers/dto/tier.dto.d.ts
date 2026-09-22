export declare class CreateTierDto {
    tierCode: string;
    tierName: string;
    description?: string;
}
export declare class UpdateTierDto {
    tierName?: string;
    description?: string;
}
export declare class AssociateQueueTierDto {
    tierId: number;
    price: number;
    currency?: string;
    displayOrder?: number;
}
export declare class UpdateQueueTierDto {
    price?: number;
    currency?: string;
    displayOrder?: number;
}
export declare class CreateNotificationRuleDto {
    notificationType: string;
    channel: string;
    thresholdPosition?: number;
    thresholdMinutes?: number;
    includeTrackingLink?: boolean;
}
export declare class UpdateNotificationRuleDto {
    thresholdPosition?: number;
    thresholdMinutes?: number;
    includeTrackingLink?: boolean;
}
