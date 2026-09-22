import { QueuesService } from './queues.service';
import { CreateQueueDto, UpdateQueueDto, AssignOperatorDto } from './dto/queue.dto';
import { UserContext } from '../../core/rbac/scope.service';
export declare class QueuesController {
    private readonly queuesService;
    constructor(queuesService: QueuesService);
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
    findBySite(user: UserContext, siteId: number): Promise<import("./queue-config.helper").EffectiveQueueConfig[]>;
    findById(user: UserContext, queueId: number): Promise<import("./queue-config.helper").EffectiveQueueConfig>;
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
    assignOperator(user: UserContext, queueId: number, dto: AssignOperatorDto): Promise<{
        userId: number;
        assignedAt: Date;
        queueId: number;
    }>;
    unassignOperator(user: UserContext, queueId: number, userId: number): Promise<{
        success: boolean;
    }>;
}
