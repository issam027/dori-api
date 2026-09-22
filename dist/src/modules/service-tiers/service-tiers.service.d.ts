import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreateTierDto, UpdateTierDto, AssociateQueueTierDto, UpdateQueueTierDto, CreateNotificationRuleDto, UpdateNotificationRuleDto } from './dto/tier.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
export declare class ServiceTiersService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    findAllTiers(pagination: PaginationQueryDto): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
    }>>;
    findTierById(tierId: number): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
    }>;
    createTier(dto: CreateTierDto): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
    }>;
    updateTier(tierId: number, dto: UpdateTierDto): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
    }>;
    deleteTier(tierId: number): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
    }>;
    findTiersByQueue(user: UserContext, queueId: number): Promise<{
        tierId: number;
        tierCode: string;
        tierName: string;
        isSystem: boolean;
        price: number;
        currency: string;
        displayOrder: number;
        notificationRules: {
            queueId: number;
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            tierId: number;
            notificationType: string;
            channel: string;
            thresholdPosition: number | null;
            thresholdMinutes: number | null;
            includeTrackingLink: boolean;
            ruleId: number;
        }[];
    }[]>;
    associateTierToQueue(user: UserContext, queueId: number, dto: AssociateQueueTierDto): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        price: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        displayOrder: number;
    }>;
    updateQueueTier(user: UserContext, queueId: number, tierId: number, dto: UpdateQueueTierDto): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        price: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        displayOrder: number;
    }>;
    deleteQueueTier(user: UserContext, queueId: number, tierId: number): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        price: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        displayOrder: number;
    }>;
    findRulesByQueueTier(user: UserContext, queueId: number, tierId: number): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        notificationType: string;
        channel: string;
        thresholdPosition: number | null;
        thresholdMinutes: number | null;
        includeTrackingLink: boolean;
        ruleId: number;
    }[]>;
    createNotificationRule(user: UserContext, queueId: number, tierId: number, dto: CreateNotificationRuleDto): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        notificationType: string;
        channel: string;
        thresholdPosition: number | null;
        thresholdMinutes: number | null;
        includeTrackingLink: boolean;
        ruleId: number;
    }>;
    updateNotificationRule(user: UserContext, queueId: number, tierId: number, ruleId: number, dto: UpdateNotificationRuleDto): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        notificationType: string;
        channel: string;
        thresholdPosition: number | null;
        thresholdMinutes: number | null;
        includeTrackingLink: boolean;
        ruleId: number;
    }>;
    deleteNotificationRule(user: UserContext, queueId: number, tierId: number, ruleId: number): Promise<{
        queueId: number;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        tierId: number;
        notificationType: string;
        channel: string;
        thresholdPosition: number | null;
        thresholdMinutes: number | null;
        includeTrackingLink: boolean;
        ruleId: number;
    }>;
    getDisplayScreen(user: UserContext, queueId: number): Promise<{
        queueId: number;
        queueCode: string;
        queueName: string | null;
        currentCalls: {
            threadNumber: number | null;
            ticketNumber: string;
        }[];
        nextTickets: string[];
    }>;
}
