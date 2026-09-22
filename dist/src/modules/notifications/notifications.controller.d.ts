import { NotificationsService } from './notifications.service';
import { WebhookNotificationDto } from './dto/notification.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { UserContext } from '../../core/rbac/scope.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    findAll(user: UserContext, pagination: PaginationQueryDto, registrationId?: number, channel?: string, status?: string): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        customer: {
            queueId: number;
            ticketNumber: string;
        };
    } & {
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        customerId: number;
        notificationType: string;
        channel: string;
        ruleId: number | null;
        providerMessageId: string | null;
        failureReason: string | null;
        notificationId: number;
        recipient: string;
        notificationContent: string | null;
        notificationStatus: string;
        attemptCount: number;
        sentAt: Date | null;
        deliveredAt: Date | null;
    }>>;
    findById(user: UserContext, notificationId: number): Promise<{
        customer: {
            queueId: number;
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            languagePreference: string | null;
            createdByUserId: number | null;
            status: string;
            tierId: number;
            businessDate: Date;
            customerId: number;
            personId: number;
            ticketNumber: string;
            entryType: string;
            scheduledTime: Date | null;
            checkedInAt: Date | null;
            appointmentStatus: string;
            priorityReferenceTime: Date;
            currentSessionId: number | null;
            calledAt: Date | null;
            servedAt: Date | null;
            closedAt: Date | null;
            carriedOverFromDate: Date | null;
            registrationTrackingToken: string;
            registrationTrackingTokenValidUntil: Date;
        };
    } & {
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        customerId: number;
        notificationType: string;
        channel: string;
        ruleId: number | null;
        providerMessageId: string | null;
        failureReason: string | null;
        notificationId: number;
        recipient: string;
        notificationContent: string | null;
        notificationStatus: string;
        attemptCount: number;
        sentAt: Date | null;
        deliveredAt: Date | null;
    }>;
    resend(user: UserContext, notificationId: number): Promise<{
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        customerId: number;
        notificationType: string;
        channel: string;
        ruleId: number | null;
        providerMessageId: string | null;
        failureReason: string | null;
        notificationId: number;
        recipient: string;
        notificationContent: string | null;
        notificationStatus: string;
        attemptCount: number;
        sentAt: Date | null;
        deliveredAt: Date | null;
    }>;
    handleWebhook(provider: string, dto: WebhookNotificationDto): Promise<{
        received: boolean;
        success?: undefined;
    } | {
        success: boolean;
        received?: undefined;
    }>;
}
