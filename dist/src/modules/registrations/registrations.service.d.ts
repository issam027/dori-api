import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreateRegistrationDto, RescheduleAppointmentDto } from './dto/registration.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
export declare class RegistrationsService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    create(user: UserContext, dto: CreateRegistrationDto): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            ticketNumber: string;
        };
        data: {
            registrationId: number;
            ticketNumber: string;
            businessDate: string;
            entryType: string;
            appointmentStatus: string;
            scheduledTime: string | null;
            status: string;
            tier: {
                tierId: number;
                tierCode: string;
                price: number;
                currency: string;
            };
            priorityReferenceTime: string;
            trackingUrl: string | undefined;
            registrationTrackingTokenValidUntil: string;
        };
    }>;
    reschedule(user: UserContext, registrationId: number, dto: RescheduleAppointmentDto): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            scheduledTime: string;
        };
        data: {
            registrationId: number;
            appointmentStatus: string;
            scheduledTime: string | undefined;
            priorityReferenceTime: string;
        };
    }>;
    checkIn(user: UserContext, registrationId: number): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            ticketNumber: string;
        };
        data: {
            registrationId: number;
            appointmentStatus: string;
            checkedInAt: string | undefined;
        };
    }>;
    getAvailability(user: UserContext, queueId: number, dateStr: string): Promise<{
        queueId: number;
        date: string;
        slotDuration: number;
        slots: {
            time: string;
            slotCapacity: number;
            bookedCount: number;
            availableCount: number;
            isFull: boolean;
        }[];
    }>;
    getPublicPosition(trackingToken: string): Promise<{
        code: string;
        translationKey: string;
        translationParams: {
            position?: undefined;
            minutes?: undefined;
        };
        data: {
            status: string;
            ticketNumber?: undefined;
            position?: undefined;
            estimatedWaitMinutes?: undefined;
        };
    } | {
        code: string;
        translationKey: string;
        translationParams: {
            position: number;
            minutes: number;
        };
        data: {
            ticketNumber: string;
            status: string;
            position: number;
            estimatedWaitMinutes: number;
        };
    }>;
    findAll(user: UserContext, pagination: PaginationQueryDto, queueId?: number, status?: string, entryType?: string): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        queue: {
            queueCode: string;
            queueName: string | null;
        };
        person: {
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            languagePreference: string;
            personId: number;
            firstName: string | null;
            lastName: string | null;
            phoneNumber: string | null;
            birthDate: Date | null;
        };
        queueTier: {
            tier: {
                isActive: boolean;
                deletedAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                tierId: number;
                tierCode: string;
                tierName: string;
                isSystem: boolean;
            };
        } & {
            queueId: number;
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            tierId: number;
            price: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            displayOrder: number;
        };
    } & {
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
    }>>;
    findById(user: UserContext, registrationId: number): Promise<{
        queue: {
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
        };
        person: {
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            languagePreference: string;
            personId: number;
            firstName: string | null;
            lastName: string | null;
            phoneNumber: string | null;
            birthDate: Date | null;
        };
        queueTier: {
            tier: {
                isActive: boolean;
                deletedAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                tierId: number;
                tierCode: string;
                tierName: string;
                isSystem: boolean;
            };
        } & {
            queueId: number;
            isActive: boolean;
            deletedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            tierId: number;
            price: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            displayOrder: number;
        };
    } & {
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
    }>;
    delete(user: UserContext, registrationId: number): Promise<{
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
    }>;
}
