import { ClockService } from '../../core/clock/clock.service';
import { AppointmentExpiryRepository } from './appointment-expiry.repository';
import { AppointmentExpiryWorker } from './appointment-expiry.worker';

describe('AppointmentExpiryWorker', () => {
  it('delegates persistence using the centralized clock', async () => {
    const now = new Date('2026-10-06T12:00:00Z');
    const repository = {
      expireLateAppointments: jest.fn().mockResolvedValue([]),
    } as unknown as AppointmentExpiryRepository;
    const clock = {
      now: jest.fn().mockReturnValue(now),
    } as unknown as ClockService;

    await new AppointmentExpiryWorker(
      repository,
      clock,
    ).handleAppointmentExpiry();

    expect(repository.expireLateAppointments).toHaveBeenCalledWith(now);
  });
});
