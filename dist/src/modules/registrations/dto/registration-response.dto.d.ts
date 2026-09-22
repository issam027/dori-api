import { PersonResponseDto } from '../../persons/dto/person-response.dto';
export declare class AvailabilitySlotDto {
    time: string;
    slotCapacity: number;
    bookedCount: number;
    availableCount: number;
    isFull: boolean;
}
export declare class AvailabilityResponseDto {
    queueId: number;
    date: string;
    slotDuration: number;
    slots: AvailabilitySlotDto[];
}
export declare class RegistrationTierSummaryDto {
    tierId: number;
    tierCode: string;
    price?: number;
    currency?: string;
}
export declare class RegistrationCreatedResponseDto {
    registrationId: number;
    ticketNumber: string;
    businessDate: string;
    entryType: string;
    appointmentStatus?: string | null;
    scheduledTime?: string | null;
    status: string;
    tier: RegistrationTierSummaryDto;
    priorityReferenceTime: string;
    trackingUrl?: string;
    registrationTrackingTokenValidUntil: string;
}
export declare class QueueHeaderSummaryDto {
    queueCode: string;
    queueName?: string | null;
}
export declare class QueueTierFullSummaryDto {
    tierId: number;
    queueId: number;
    price: number;
    currency: string;
    tier: RegistrationTierSummaryDto;
}
export declare class RegistrationDetailDto {
    customerId: number;
    personId: number;
    queueId: number;
    tierId: number;
    businessDate: Date;
    ticketNumber: string;
    entryType: string;
    scheduledTime?: Date | null;
    appointmentStatus?: string | null;
    priorityReferenceTime: Date;
    status: string;
    calledAt?: Date | null;
    servedAt?: Date | null;
    closedAt?: Date | null;
    person: PersonResponseDto;
    queue: QueueHeaderSummaryDto;
    queueTier?: QueueTierFullSummaryDto | null;
}
export declare class RescheduleResponseDto {
    registrationId: number;
    appointmentStatus: string;
    scheduledTime: string;
    priorityReferenceTime: string;
}
export declare class CheckInResponseDto {
    registrationId: number;
    appointmentStatus: string;
    checkedInAt: string;
}
export declare class PublicPositionResponseDto {
    ticketNumber: string;
    status: string;
    position?: number;
    estimatedWaitMinutes?: number;
}
