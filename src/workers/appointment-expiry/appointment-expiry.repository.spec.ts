import { DataSource } from 'typeorm';
import { AppointmentExpiryRepository } from './appointment-expiry.repository';

describe('AppointmentExpiryRepository', () => {
  it('expires late appointments under an advisory transaction lock', async () => {
    const now = new Date('2026-10-06T12:00:00Z');
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        [{ registration_id: 3, ticket_number: 'A-003' }],
        1,
      ]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    const rows = await new AppointmentExpiryRepository(
      dataSource,
    ).expireLateAppointments(now);

    expect(rows).toEqual([{ registration_id: 3, ticket_number: 'A-003' }]);
    expect(query.mock.calls[1][0]).toContain('c.scheduled_time');
    expect(query.mock.calls[1][1]).toEqual([now]);
  });

  it('does not mutate appointments when the lock is unavailable', async () => {
    const query = jest.fn().mockResolvedValue([{ acquired: false }]);
    const dataSource = {
      transaction: jest.fn((callback) => callback({ query })),
    } as unknown as DataSource;

    const rows = await new AppointmentExpiryRepository(
      dataSource,
    ).expireLateAppointments(new Date());

    expect(rows).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
