import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface EstimationQueueRow {
  site_id: string;
  queue_id: string;
  timezone: string;
}

@Injectable()
export class QueueStatisticsRepository {
  constructor(private readonly dataSource: DataSource) {}

  findActiveQueues(now: Date): Promise<EstimationQueueRow[]> {
    return this.dataSource.query(
      `SELECT q.site_id, q.queue_id, s.timezone
       FROM dorify.dori_queue q JOIN dorify.dori_site s ON s.site_id = q.site_id
       WHERE q.is_active AND s.is_active
         AND dorify.queue_estimation_needs_refresh(q.queue_id,($1::timestamptz AT TIME ZONE s.timezone)::date,$1)
       ORDER BY q.site_id, q.queue_id`,
      [now],
    );
  }

  aggregateQueue(input: {
    siteId: string;
    queueId: string;
    activityDate: string;
    now: Date;
  }): Promise<boolean> {
    return this.dataSource
      .query<Array<{ refreshed: boolean }>>(
        'SELECT dorify.queue_refresh_estimation_stats($1,$2,$3::date,$4,TRUE) AS refreshed',
        [input.siteId, input.queueId, input.activityDate, input.now],
      )
      .then((rows) => rows[0]?.refreshed ?? false);
  }
}
