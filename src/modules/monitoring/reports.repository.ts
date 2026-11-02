import {
  monitoringSeriesQueries,
  MonitoringSeriesInput,
} from './monitoring-series.query';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface QueueIdentityRow {
  queue_id?: string;
  site_id?: string;
  queue_name: string;
  queue_code: string;
  site_name: string;
  timezone?: string;
}

export interface MonitoringSeriesData {
  totals: Record<string, unknown>;
  series: Array<Record<string, unknown>>;
  byQueue: Array<Record<string, unknown>>;
  byQueueSeries: Array<Record<string, unknown>>;
  byUser: Array<Record<string, unknown>>;
  byTier: Array<Record<string, unknown>>;
  byEntryType: Array<Record<string, unknown>>;
  byStatus: Array<Record<string, unknown>>;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly dataSource: DataSource) {}

  findScopeIdentities(input: {
    queueIds?: string[];
    siteId?: string;
  }): Promise<QueueIdentityRow[]> {
    const params: unknown[] = [];
    let where = '1=1';
    if (input.queueIds) {
      params.push(input.queueIds);
      where += ` AND q.queue_id = ANY($${params.length})`;
    }
    if (input.siteId !== undefined) {
      params.push(input.siteId);
      where += ` AND s.site_id = $${params.length}`;
    }
    return this.dataSource.query(
      `SELECT q.queue_id, q.queue_code, q.queue_name, s.site_id, s.site_name, s.timezone
       FROM dorify.dori_queue q JOIN dorify.dori_site s ON s.site_id=q.site_id
       WHERE ${where} ORDER BY q.queue_id`,
      params,
    );
  }

  async getMonitoringSeries(
    input: MonitoringSeriesInput,
  ): Promise<MonitoringSeriesData> {
    const [
      totalsRows,
      series,
      byQueue,
      byQueueSeries,
      byUser,
      byTier,
      byEntryType,
      byStatus,
    ] = await Promise.all(
      monitoringSeriesQueries(input).map(({ sql, parameters }) =>
        this.dataSource.query(sql, parameters),
      ),
    );
    return {
      totals: totalsRows[0] ?? {},
      series,
      byQueue,
      byQueueSeries,
      byUser,
      byTier,
      byEntryType,
      byStatus,
    };
  }
}
