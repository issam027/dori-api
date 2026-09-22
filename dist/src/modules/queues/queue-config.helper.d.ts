import { Queue, Site } from '@prisma/client';
export interface ConfigField<T> {
    value: T;
    source: 'inherited' | 'overridden';
}
export interface EffectiveQueueConfig {
    queueId: number;
    queueCode: string;
    siteId: number;
    queueName: string | null;
    averageWaitTime: number;
    threadCount: number;
    appointmentsEnabled: ConfigField<boolean>;
    appointmentSlotDuration: ConfigField<number>;
    slotCapacity: ConfigField<number>;
    workingHoursStart: ConfigField<string>;
    workingHoursEnd: ConfigField<string>;
    breakStart: ConfigField<string | null>;
    breakEnd: ConfigField<string | null>;
    lateToleranceMinutes: ConfigField<number>;
    baseWeightWalkin: ConfigField<number>;
    baseWeightAppointment: ConfigField<number>;
    escalationRateWalkin: ConfigField<number>;
    escalationRateAppointment: ConfigField<number>;
    carryOverWaiting: ConfigField<boolean>;
    dailyResetMode: ConfigField<string>;
    dailyResetTime: ConfigField<string>;
}
export declare function resolveQueueConfig(queue: Queue, site: Site): EffectiveQueueConfig;
