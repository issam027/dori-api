import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface SiteIdRow {
  site_id: string | string;
}
interface QueueScopeRow extends SiteIdRow {
  queue_id: string | string;
}

@Injectable()
export class ScopeRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findUserSiteIds(userId: string): Promise<string[]> {
    const rows: SiteIdRow[] = await this.dataSource.query(
      `SELECT site_id FROM dorify.dori_user_site_assignment WHERE user_id = $1`,
      [userId],
    );
    return rows.map((row) => String(row.site_id));
  }

  async findQueueIdsBySites(siteIds: string[]): Promise<string[]> {
    if (siteIds.length === 0) return [];
    const rows: Array<{ queue_id: string | string }> =
      await this.dataSource.query(
        `SELECT queue_id FROM dorify.dori_queue
       WHERE site_id = ANY($1)`,
        [siteIds],
      );
    return rows.map((row) => String(row.queue_id));
  }

  async findUserQueueScope(
    userId: string,
  ): Promise<{ queueIds: string[]; siteIds: string[] }> {
    const rows: QueueScopeRow[] = await this.dataSource.query(
      `SELECT uq.queue_id, q.site_id FROM dorify.dori_user_queue_assignment uq
       JOIN dorify.dori_queue q ON q.queue_id = uq.queue_id
       WHERE uq.user_id = $1`,
      [userId],
    );
    return {
      queueIds: rows.map((row) => String(row.queue_id)),
      siteIds: rows.map((row) => String(row.site_id)),
    };
  }
}
