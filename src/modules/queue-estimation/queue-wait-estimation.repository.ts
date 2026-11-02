import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface WaitEstimationRegistration {
  registration_id: string;
}
export type EstimationMethod =
  'queue_daily_p50' | 'last_calculated' | 'theoretical_queue' | 'unavailable';
export interface OperationalEstimateRow {
  registration_id?: string;
  position?: number | null;
  estimated_wait_minutes: number | null;
  method: EstimationMethod;
  sample_size: number | null;
  is_reliable: boolean;
  calculated_at: Date | string;
  stats_calculated_at: Date | string | null;
}
export interface QueueContextRow extends OperationalEstimateRow {
  queue_id: string;
  waiting_count: number;
  active_threads: number;
}

@Injectable()
export class QueueWaitEstimationRepository {
  constructor(private readonly dataSource: DataSource) {}

  findTicketEstimates(
    registrationIds: string[],
    now: Date,
  ): Promise<OperationalEstimateRow[]> {
    if (!registrationIds.length) return Promise.resolve([]);
    return this.dataSource.query(
      `SELECT * FROM dorify.queue_ticket_estimates(
        ARRAY(SELECT DISTINCT queue_id FROM dorify.dori_registration WHERE registration_id=ANY($1::uuid[])), $2,TRUE,$1::uuid[])`,
      [registrationIds, now],
    );
  }

  async findQueueContext(
    queueId: string,
    now: Date,
    activityDate: string,
  ): Promise<QueueContextRow | null> {
    const rows = await this.dataSource.query<QueueContextRow[]>(
      'SELECT * FROM dorify.queue_wait_context(ARRAY[$1::uuid],$2,$3::date)',
      [queueId, now, activityDate],
    );
    return rows[0] ?? null;
  }
}
