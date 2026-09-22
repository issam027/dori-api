export declare class OpenSessionResponseDto {
    sessionId: number;
    queueId: number;
    userId: number;
    threadNumber?: number | null;
    mode: string;
    connectedAt: string;
    takenOverFromSessionId?: number | null;
    reassignedRegistrationId?: number | null;
}
export declare class CalledPersonDto {
    personId: number;
    firstName: string;
    lastName: string;
    phone: string;
    hasNotes: boolean;
}
export declare class CalledTierDto {
    tierId: number;
    tierCode: string;
    tierName: string;
}
export declare class CallNextResponseDto {
    registrationId: number;
    ticketNumber: string;
    entryType: string;
    scheduledTime?: string | null;
    calledEarly: boolean;
    tier: CalledTierDto;
    status: string;
    sessionId: number;
    threadNumber?: number | null;
    priorityScore: number;
    calledAt?: string | null;
    person: CalledPersonDto;
}
export declare class CompleteRegistrationResponseDto {
    registrationId: number;
    status: string;
    servedAt?: string | null;
    closedAt?: string | null;
    handledBySessionId?: number | null;
    handledByUserId: number;
}
