import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returningRows } from '../../core/database/returning-rows';

export interface ExpiredAppointmentRow {
  registration_id: number;
  ticket_number: string;
}

@Injectable()
export class AppointmentExpiryRepository {
  constructor(private readonly dataSource: DataSource) {}

  expireLateAppointments(now: Date): Promise<ExpiredAppointmentRow[]> {
    return this.dataSource.transaction(async (manager) => {
      const lock = returningRows<{ acquired: boolean }>(
        await manager.query(
          'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
          ['appointment-expiry'],
        ),
      );
      if (!lock[0]?.acquired) return [];

      const raw: unknown = await manager.query(
        `UPDATE dori_registration c
         SET status = 'expired', appointment_status = 'expired',
             closed_at = $1, is_active = FALSE, updated_at = $1
         FROM dori_site_queue_thread q
         JOIN dori_site s ON s.site_id = q.site_id
         WHERE c.queue_id = q.queue_id
           AND c.entry_type = 'appointment'
           AND c.status IN ('booked', 'rescheduled')
           AND c.is_active = TRUE
           AND (c.scheduled_time + (
             COALESCE(q.late_tolerance_minutes, s.default_late_tolerance_minutes, 60)
             * INTERVAL '1 minute'
           )) < $1
         RETURNING c.registration_id, c.ticket_number`,
        [now],
      );
      return returningRows<ExpiredAppointmentRow>(raw);
    });
  }
}
