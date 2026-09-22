import { resolveQueueConfig } from '../src/modules/queues/queue-config.helper';

describe('Héritage Site -> Queue (§4.5)', () => {
  const mockSite: any = {
    siteId: 1,
    siteName: 'Clinique Test',
    defaultAppointmentsEnabled: false,
    defaultAppointmentSlotDuration: 15,
    defaultSlotCapacity: 1,
    defaultWorkingHoursStart: '08:00',
    defaultWorkingHoursEnd: '17:00',
    defaultBreakStart: '12:00',
    defaultBreakEnd: '14:00',
    defaultLateToleranceMinutes: 60,
    defaultBaseWeightWalkin: 0,
    defaultBaseWeightAppointment: 60,
    defaultEscalationRateWalkin: 1,
    defaultEscalationRateAppointment: 1,
    defaultCarryOverWaiting: false,
    defaultDailyResetMode: 'close_all',
    defaultDailyResetTime: '03:00',
  };

  it('hérite des valeurs du site quand les colonnes de la queue sont nulles', () => {
    const mockQueue: any = {
      queueId: 10,
      queueCode: 'GEN',
      siteId: 1,
      queueName: 'Généraliste',
      averageWaitTime: 10,
      threadCount: 2,
      appointmentsEnabled: null,
      appointmentSlotDuration: null,
      slotCapacity: null,
      workingHoursStart: null,
      workingHoursEnd: null,
      breakStart: null,
      breakEnd: null,
      lateToleranceMinutes: null,
      baseWeightWalkin: null,
      baseWeightAppointment: null,
      escalationRateWalkin: null,
      escalationRateAppointment: null,
      carryOverWaiting: null,
      dailyResetMode: null,
      dailyResetTime: null,
    };

    const resolved = resolveQueueConfig(mockQueue, mockSite);

    expect(resolved.appointmentsEnabled.source).toBe('inherited');
    expect(resolved.appointmentsEnabled.value).toBe(false);
    expect(resolved.slotCapacity.source).toBe('inherited');
    expect(resolved.slotCapacity.value).toBe(1);
    expect(resolved.workingHoursStart.value).toBe('08:00');
    expect(resolved.baseWeightAppointment.value).toBe(60);
  });

  it('applique les surcharges de la file quand elles sont renseignées', () => {
    const mockQueue: any = {
      queueId: 11,
      queueCode: 'DENT',
      siteId: 1,
      queueName: 'Dentaire',
      averageWaitTime: 20,
      threadCount: 3,
      appointmentsEnabled: true,
      appointmentSlotDuration: 30,
      slotCapacity: 2,
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      breakStart: null,
      breakEnd: null,
      lateToleranceMinutes: 45,
      baseWeightWalkin: null,
      baseWeightAppointment: null,
      escalationRateWalkin: null,
      escalationRateAppointment: null,
      carryOverWaiting: true,
      dailyResetMode: 'close_served_only',
      dailyResetTime: '04:00',
    };

    const resolved = resolveQueueConfig(mockQueue, mockSite);

    expect(resolved.appointmentsEnabled.source).toBe('overridden');
    expect(resolved.appointmentsEnabled.value).toBe(true);
    expect(resolved.appointmentSlotDuration.source).toBe('overridden');
    expect(resolved.appointmentSlotDuration.value).toBe(30);
    expect(resolved.slotCapacity.value).toBe(2);
    expect(resolved.carryOverWaiting.value).toBe(true);
    expect(resolved.dailyResetMode.value).toBe('close_served_only');
    expect(resolved.breakStart.source).toBe('inherited');
    expect(resolved.breakStart.value).toBe('12:00');
  });
});
