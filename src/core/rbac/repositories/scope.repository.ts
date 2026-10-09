import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface SiteIdRow {
  site_id: number | string;
}
interface QueueScopeRow extends SiteIdRow {
  queue_id: number | string;
}

@Injectable()
export class ScopeRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findUserSiteIds(userId: number): Promise<number[]> {
    const rows: SiteIdRow[] = await this.dataSource.query(
      `SELECT site_id FROM dori_user_site WHERE user_id = $1`,
      [userId],
    );
    return rows.map((row) => Number(row.site_id));
  }

  async findActiveQueueIdsBySites(siteIds: number[]): Promise<number[]> {
    if (siteIds.length === 0) return [];
    const rows: Array<{ queue_id: number | string }> =
      await this.dataSource.query(
        `SELECT queue_id FROM dori_site_queue_thread
       WHERE site_id = ANY($1) AND is_active = TRUE`,
        [siteIds],
      );
    return rows.map((row) => Number(row.queue_id));
  }

  async findUserQueueScope(
    userId: number,
  ): Promise<{ queueIds: number[]; siteIds: number[] }> {
    const rows: QueueScopeRow[] = await this.dataSource.query(
      `SELECT uq.queue_id, q.site_id FROM dori_user_queue uq
       JOIN dori_site_queue_thread q ON q.queue_id = uq.queue_id
       WHERE uq.user_id = $1 AND q.is_active = TRUE`,
      [userId],
    );
    return {
      queueIds: rows.map((row) => Number(row.queue_id)),
      siteIds: rows.map((row) => Number(row.site_id)),
    };
  }
}
