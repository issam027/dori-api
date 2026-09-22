import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreateQueueDto, UpdateQueueDto } from './dto/queue.dto';
export declare class QueuesService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    create(siteId: number, dto: CreateQueueDto): Promise<{
        siteId: number;
        queueId: number;
        queueCode: string;
        queueName: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        averageWaitTime: number;
        threadCount: number;
        appointmentsEnabled: boolean | null;
        appointmentSlotDuration: number | null;
        slotCapacity: number | null;
        workingHoursStart: string | null;
        workingHoursEnd: string | null;
        breakStart: string | null;
        breakEnd: string | null;
        lateToleranceMinutes: number | null;
        baseWeightWalkin: import("@prisma/client/runtime/library").Decimal | null;
        baseWeightAppointment: import("@prisma/client/runtime/library").Decimal | null;
        escalationRateWalkin: import("@prisma/client/runtime/library").Decimal | null;
        escalationRateAppointment: import("@prisma/client/runtime/library").Decimal | null;
        carryOverWaiting: boolean | null;
        dailyResetMode: string | null;
        dailyResetTime: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findById(user: UserContext, queueId: number): Promise<import("./queue-config.helper").EffectiveQueueConfig>;
    findBySite(user: UserContext, siteId: number): Promise<import("./queue-config.helper").EffectiveQueueConfig[]>;
    update(user: UserContext, queueId: number, dto: UpdateQueueDto): Promise<import("./queue-config.helper").EffectiveQueueConfig>;
    delete(user: UserContext, queueId: number): Promise<{
        siteId: number;
        queueId: number;
        queueCode: string;
        queueName: string | null;
        isActive: boolean;
        deletedAt: Date | null;
        averageWaitTime: number;
        threadCount: number;
        appointmentsEnabled: boolean | null;
        appointmentSlotDuration: number | null;
        slotCapacity: number | null;
        workingHoursStart: string | null;
        workingHoursEnd: string | null;
        breakStart: string | null;
        breakEnd: string | null;
        lateToleranceMinutes: number | null;
        baseWeightWalkin: import("@prisma/client/runtime/library").Decimal | null;
        baseWeightAppointment: import("@prisma/client/runtime/library").Decimal | null;
        escalationRateWalkin: import("@prisma/client/runtime/library").Decimal | null;
        escalationRateAppointment: import("@prisma/client/runtime/library").Decimal | null;
        carryOverWaiting: boolean | null;
        dailyResetMode: string | null;
        dailyResetTime: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getStatus(user: UserContext, queueId: number): Promise<{
        queueId: number;
        queueCode: string;
        waitingCount: number;
        activeThreadsCount: number;
        totalThreads: number;
        estimatedWaitMinutes: number;
        nextAppointments: {
            status: string;
            customerId: number;
            ticketNumber: string;
            scheduledTime: Date | null;
            appointmentStatus: string;
        }[];
    }>;
    getThreads(user: UserContext, queueId: number): Promise<{
        queueId: number;
        threadCount: number;
        threads: ({
            threadNumber: number;
            status: string;
            session: null;
        } | {
            threadNumber: number;
            status: string;
            session: {
                sessionId: any;
                userId: any;
                username: any;
                connectedAt: any;
                lastSeenAt: any;
                inactiveMinutes: number;
                currentRegistrationId: any;
            };
        })[];
    }>;
    getOperators(user: UserContext, queueId: number): Promise<{
        userId: number;
        username: string;
        email: string | null;
        userType: string;
    }[]>;
    assignOperator(user: UserContext, queueId: number, targetUserId: number): Promise<{
        userId: number;
        assignedAt: Date;
        queueId: number;
    }>;
    unassignOperator(user: UserContext, queueId: number, targetUserId: number): Promise<{
        success: boolean;
    }>;
}
