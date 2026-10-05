import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class AppointmentExpiryWorker {
  private readonly logger = new Logger(AppointmentExpiryWorker.name);
  private isRunning = false;

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAppointmentExpiry() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.logger.debug('Running appointment expiry worker...');

      // Mark expired all booked/rescheduled appointments that exceeded late tolerance (§4.3)
      const rows = await this.dataSource.query(`
        UPDATE dori_customer c
        SET status = 'expired',
            appointment_status = 'expired',
            closed_at = CURRENT_TIMESTAMP,
            is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        FROM dori_site_queue_thread q
        JOIN dori_site s ON s.site_id = q.site_id
        WHERE c.queue_id = q.queue_id
          AND c.entry_type = 'appointment'
          AND c.status IN ('booked', 'rescheduled')
          AND c.is_active = TRUE
          AND (c.scheduled_time + (COALESCE(q.late_tolerance_minutes, s.default_late_tolerance_minutes, 60) * INTERVAL '1 minute')) < CURRENT_TIMESTAMP
        RETURNING c.customer_id, c.ticket_number
      `);
      if (rows && rows.length > 0) {
        this.logger.log(
          `Expired ${rows.length} late appointment(s): ${rows.map((r: any) => r.ticket_number).join(', ')}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Error in appointment expiry worker: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
