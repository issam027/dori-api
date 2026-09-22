export declare class ConfigFieldDto<T = any> {
    value: T;
    source: 'inherited' | 'overridden';
}
export declare class QueueResponseDto {
    queueId: number;
    queueCode: string;
    siteId: number;
    queueName?: string | null;
    averageWaitTime: number;
    threadCount: number;
    appointmentsEnabled: ConfigFieldDto<boolean>;
    appointmentSlotDuration: ConfigFieldDto<number>;
    slotCapacity: ConfigFieldDto<number>;
    workingHoursStart: ConfigFieldDto<string>;
    workingHoursEnd: ConfigFieldDto<string>;
    breakStart: ConfigFieldDto<string | null>;
    breakEnd: ConfigFieldDto<string | null>;
    lateToleranceMinutes: ConfigFieldDto<number>;
    baseWeightWalkin: ConfigFieldDto<number>;
    baseWeightAppointment: ConfigFieldDto<number>;
    escalationRateWalkin: ConfigFieldDto<number>;
    escalationRateAppointment: ConfigFieldDto<number>;
    carryOverWaiting: ConfigFieldDto<boolean>;
    dailyResetMode: ConfigFieldDto<string>;
    dailyResetTime: ConfigFieldDto<string>;
}
export declare class NextAppointmentDto {
    customerId: number;
    ticketNumber: string;
    scheduledTime?: Date | null;
    appointmentStatus?: string | null;
    status: string;
}
export declare class QueueStatusResponseDto {
    queueId: number;
    queueCode: string;
    waitingCount: number;
    activeThreadsCount: number;
    totalThreads: number;
    estimatedWaitMinutes: number;
    nextAppointments: NextAppointmentDto[];
}
export declare class QueueThreadSessionDto {
    sessionId: number;
    userId: number;
    username: string;
    connectedAt: string;
    lastSeenAt: string;
    inactiveMinutes: number;
    currentRegistrationId?: number | null;
}
export declare class QueueThreadDto {
    threadNumber: number;
    status: string;
    session: QueueThreadSessionDto | null;
}
export declare class QueueThreadsResponseDto {
    queueId: number;
    threadCount: number;
    threads: QueueThreadDto[];
}
export declare class QueueOperatorDto {
    userId: number;
    username: string;
    email?: string | null;
    userType: string;
}
export declare class QueueOperatorAssignmentResponseDto {
    userId: number;
    queueId: number;
    assignedAt: Date;
}
