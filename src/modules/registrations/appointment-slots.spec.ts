import { appointmentSlotTimes } from './appointment-slots';

describe('appointment daily slot template', () => {
  it('excludes every slot overlapping a break even when it is not aligned with the grid', () => {
    expect(
      appointmentSlotTimes('08:00:00', '10:00:00', 30, '08:45', '09:15'),
    ).toEqual(['08:00:00', '09:30:00']);
  });
  it('keeps boundary slots and excludes a partial slot at closing', () => {
    expect(
      appointmentSlotTimes('08:00', '10:10', 30, '08:30', '09:00'),
    ).toEqual(['08:00:00', '09:00:00', '09:30:00']);
  });
  it('rejects zero and invalid durations instead of looping indefinitely', () => {
    for (const duration of [0, -1, NaN, Infinity, 1.5])
      expect(() => appointmentSlotTimes('08:00', '10:00', duration)).toThrow();
  });
});
