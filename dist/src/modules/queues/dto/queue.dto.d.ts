export declare class CreateQueueDto {
    queueCode: string;
    queueName?: string;
    averageWaitTime?: number;
    threadCount?: number;
    appointmentsEnabled?: boolean;
    appointmentSlotDuration?: number;
    slotCapacity?: number;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    breakStart?: string;
    breakEnd?: string;
    lateToleranceMinutes?: number;
    baseWeightWalkin?: number;
    baseWeightAppointment?: number;
    escalationRateWalkin?: number;
    escalationRateAppointment?: number;
    carryOverWaiting?: boolean;
    dailyResetMode?: string;
    dailyResetTime?: string;
}
export declare class UpdateQueueDto {
    queueName?: string;
    averageWaitTime?: number;
    threadCount?: number;
    appointmentsEnabled?: boolean;
    appointmentSlotDuration?: number;
    slotCapacity?: number;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    breakStart?: string;
    breakEnd?: string;
    lateToleranceMinutes?: number;
    baseWeightWalkin?: number;
    baseWeightAppointment?: number;
    escalationRateWalkin?: number;
    escalationRateAppointment?: number;
    carryOverWaiting?: boolean;
    dailyResetMode?: string;
    dailyResetTime?: string;
}
export declare class AssignOperatorDto {
    userId: number;
}
