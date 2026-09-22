"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveQueueConfig = resolveQueueConfig;
function resolveQueueConfig(queue, site) {
    const resolve = (queueVal, siteVal) => {
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
        baseWeightWalkin: resolve(queue.baseWeightWalkin ? Number(queue.baseWeightWalkin) : null, Number(site.defaultBaseWeightWalkin)),
        baseWeightAppointment: resolve(queue.baseWeightAppointment ? Number(queue.baseWeightAppointment) : null, Number(site.defaultBaseWeightAppointment)),
        escalationRateWalkin: resolve(queue.escalationRateWalkin ? Number(queue.escalationRateWalkin) : null, Number(site.defaultEscalationRateWalkin)),
        escalationRateAppointment: resolve(queue.escalationRateAppointment ? Number(queue.escalationRateAppointment) : null, Number(site.defaultEscalationRateAppointment)),
        carryOverWaiting: resolve(queue.carryOverWaiting, site.defaultCarryOverWaiting),
        dailyResetMode: resolve(queue.dailyResetMode, site.defaultDailyResetMode),
        dailyResetTime: resolve(queue.dailyResetTime, site.defaultDailyResetTime),
    };
}
//# sourceMappingURL=queue-config.helper.js.map