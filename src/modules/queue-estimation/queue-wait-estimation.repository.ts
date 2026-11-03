import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { runtimeMetrics } from '../../core/observability/runtime-metrics';

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
  private pending?: {
    now: Date;
    ids: Set<string>;
    requests: Array<{
      ids: Set<string>;
      resolve: (rows: OperationalEstimateRow[]) => void;
      reject: (error: unknown) => void;
    }>;
  };

  constructor(private readonly dataSource: DataSource) {}

  findTicketEstimates(
    registrationIds: string[],
    now: Date,
  ): Promise<OperationalEstimateRow[]> {
    if (!registrationIds.length) return Promise.resolve([]);
    // Coalesce a burst, never retain estimates after the SQL snapshot completes.
    // Share an observation second; token validity is still checked per request.
    // Business-date boundaries and historical calls remain separate.
    if (registrationIds.length > 1000)
      return this.readTicketEstimates(registrationIds, now);
    const current = this.pending;
    if (
      current &&
      (Math.floor(current.now.getTime() / 1000) !==
        Math.floor(now.getTime() / 1000) ||
        current.ids.size + registrationIds.length > 1000)
    ) {
      this.flushTicketEstimates(current);
    }
    if (!this.pending) {
      const batch = {
        now,
        ids: new Set<string>(),
        requests: [] as NonNullable<
          QueueWaitEstimationRepository['pending']
        >['requests'],
      };
      this.pending = batch;
      setTimeout(() => this.flushTicketEstimates(batch), 25);
    }
    const batch = this.pending;
    registrationIds.forEach((id) => batch.ids.add(id));
    return new Promise((resolve, reject) => {
      batch.requests.push({ ids: new Set(registrationIds), resolve, reject });
    });
  }

  private flushTicketEstimates(
    batch: NonNullable<QueueWaitEstimationRepository['pending']>,
  ): void {
    if (this.pending !== batch) return;
    this.pending = undefined;
    void this.readTicketEstimates([...batch.ids], batch.now).then(
      (rows) => {
        const byId = new Map(rows.map((row) => [row.registration_id, row]));
        for (const request of batch.requests) {
          request.resolve(
            [...request.ids].flatMap((id) => {
              const row = byId.get(id);
              return row ? [row] : [];
            }),
          );
        }
      },
      (error: unknown) =>
        batch.requests.forEach((request) => request.reject(error)),
    );
  }

  private readTicketEstimates(
    registrationIds: string[],
    now: Date,
  ): Promise<OperationalEstimateRow[]> {
    runtimeMetrics.add('queue_ticket_estimate_queries_total');
    runtimeMetrics.add(
      'queue_ticket_estimate_tickets_total',
      registrationIds.length,
    );
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
