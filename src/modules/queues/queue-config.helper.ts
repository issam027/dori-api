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

export function resolveQueueConfig(queue: Queue, site: Site): EffectiveQueueConfig {
  const resolve = <T>(queueVal: T | null | undefined, siteVal: T): ConfigField<T> => {
    if (queueVal !== null && queueVal !== undefined) {
      return { value: queueVal, source: 'overridden' };
    }
    return { value: siteVal, source: 'inherited' };
  };

  return {
    queueId: queue.queueId,
    queueCode: queue.queueCode,
    siteId: queue.siteId,
    queueName: queue.queueName,
    averageWaitTime: queue.averageWaitTime,
    threadCount: queue.threadCount,

    appointmentsEnabled: resolve(queue.appointmentsEnabled, site.defaultAppointmentsEnabled),
    appointmentSlotDuration: resolve(queue.appointmentSlotDuration, site.defaultAppointmentSlotDuration),
    slotCapacity: resolve(queue.slotCapacity, site.defaultSlotCapacity),
    workingHoursStart: resolve(queue.workingHoursStart, site.defaultWorkingHoursStart),
    workingHoursEnd: resolve(queue.workingHoursEnd, site.defaultWorkingHoursEnd),
    breakStart: resolve(queue.breakStart, site.defaultBreakStart),
    breakEnd: resolve(queue.breakEnd, site.defaultBreakEnd),
    lateToleranceMinutes: resolve(queue.lateToleranceMinutes, site.defaultLateToleranceMinutes),

    baseWeightWalkin: resolve(
      queue.baseWeightWalkin ? Number(queue.baseWeightWalkin) : null,
      Number(site.defaultBaseWeightWalkin),
    ),
    baseWeightAppointment: resolve(
      queue.baseWeightAppointment ? Number(queue.baseWeightAppointment) : null,
      Number(site.defaultBaseWeightAppointment),
    ),
    escalationRateWalkin: resolve(
      queue.escalationRateWalkin ? Number(queue.escalationRateWalkin) : null,
      Number(site.defaultEscalationRateWalkin),
    ),
    escalationRateAppointment: resolve(
      queue.escalationRateAppointment ? Number(queue.escalationRateAppointment) : null,
      Number(site.defaultEscalationRateAppointment),
    ),

    carryOverWaiting: resolve(queue.carryOverWaiting, site.defaultCarryOverWaiting),
    dailyResetMode: resolve(queue.dailyResetMode, site.defaultDailyResetMode),
    dailyResetTime: resolve(queue.dailyResetTime, site.defaultDailyResetTime),
  };
}
