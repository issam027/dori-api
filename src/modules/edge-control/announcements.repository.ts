import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DoriException } from '../../core/errors/dori.exception';
import { returningRows } from '../../core/database/returning-rows';
import {
  CreateAnnouncementDto,
  AnnouncementResponseDto,
  AnnouncementItemDto,
  AnnouncementScope,
} from './dto/announcement.dto';

type AnnouncementRow = {
  announcement_id: string;
  scope: AnnouncementScope;
  title: string;
  message: string;
  severity: AnnouncementItemDto['severity'];
  starts_at: Date | string;
  ends_at: Date | string;
  created_at: Date | string;
  withdrawn_at: Date | string | null;
  targets: AnnouncementResponseDto['targets'];
};
const fields = `a.*,CASE a.scope WHEN 'installations' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('targetId',i.installation_id,'name',i.installation_name) ORDER BY i.installation_name) FROM dorify.dori_announcement_installation t JOIN dorify.dori_edge_installation i USING(installation_id) WHERE t.announcement_id=a.announcement_id),'[]'::jsonb)
 ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('targetId',s.site_id,'name',s.site_name) ORDER BY s.site_name) FROM dorify.dori_announcement_site t JOIN dorify.dori_site s USING(site_id) WHERE t.announcement_id=a.announcement_id),'[]'::jsonb) END AS targets`;
export function publicAnnouncement(
  row: Omit<
    AnnouncementRow,
    'scope' | 'targets' | 'created_at' | 'withdrawn_at'
  >,
): AnnouncementItemDto {
  return {
    announcementId: row.announcement_id,
    title: row.title,
    message: row.message,
    severity: row.severity,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  };
}
function adminAnnouncement(
  row: AnnouncementRow,
  now: Date,
  allowedSiteIds?: string[],
): AnnouncementResponseDto {
  const permitted =
    allowedSiteIds === undefined ? undefined : new Set(allowedSiteIds);
  return {
    ...publicAnnouncement(row),
    scope: row.scope,
    canWithdraw:
      !permitted || row.targets.every((t) => permitted.has(t.targetId)),
    targets: permitted
      ? row.targets.filter((t) => permitted.has(t.targetId))
      : row.targets,
    createdAt: new Date(row.created_at).toISOString(),
    status: row.withdrawn_at
      ? 'withdrawn'
      : new Date(row.ends_at) <= now
        ? 'expired'
        : new Date(row.starts_at) > now
          ? 'scheduled'
          : 'active',
  };
}
@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly database: DataSource) {}
  async create(
    body: CreateAnnouncementDto,
    userId: string,
    startsAt: Date,
    endsAt: Date,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await transaction.query(
        "SELECT pg_advisory_xact_lock(hashtext('dorify:announcements'))",
      );
      const installation = body.scope === 'installations';
      const relation = installation
        ? 'dorify.dori_announcement_installation'
        : 'dorify.dori_announcement_site';
      const id = installation ? 'installation_id' : 'site_id';
      const entity = installation
        ? 'dorify.dori_edge_installation'
        : 'dorify.dori_site';
      const active = installation
        ? "credential_status='active'"
        : 'is_active=TRUE';
      const targets = (await transaction.query(
        `SELECT ${id} FROM ${entity} WHERE ${id}=ANY($1::uuid[]) AND ${active} FOR KEY SHARE`,
        [body.targetIds],
      )) as object[];
      if (targets.length !== body.targetIds.length)
        throw new DoriException('RESOURCE_NOT_FOUND');
      const full = (await transaction.query(
        `SELECT t.${id} FROM ${relation} t JOIN dorify.dori_announcement a USING(announcement_id) WHERE t.${id}=ANY($1::uuid[]) AND a.withdrawn_at IS NULL AND a.ends_at>$2 GROUP BY t.${id} HAVING count(*)>=50`,
        [body.targetIds, now],
      )) as object[];
      if (full.length) throw new DoriException('CONFLICT');
      const [created] = (await transaction.query(
        `INSERT INTO dorify.dori_announcement(scope,title,message,severity,starts_at,ends_at,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING announcement_id`,
        [
          body.scope,
          body.title,
          body.message,
          body.severity,
          startsAt,
          endsAt,
          userId,
        ],
      )) as Array<{ announcement_id: string }>;
      await transaction.query(
        `INSERT INTO ${relation}(announcement_id,${id}) SELECT $1,unnest($2::uuid[])`,
        [created.announcement_id, body.targetIds],
      );
      const [row] = (await transaction.query(
        `SELECT ${fields} FROM dorify.dori_announcement a WHERE a.announcement_id=$1`,
        [created.announcement_id],
      )) as AnnouncementRow[];
      return adminAnnouncement(row, now);
    });
  }
  async list(
    scope: AnnouncementScope,
    page: number,
    pageSize: number,
    now: Date,
    allowedSiteIds?: string[],
  ) {
    const predicate = `a.scope=$1 AND ($2::uuid[] IS NULL OR EXISTS(SELECT 1 FROM dorify.dori_announcement_site t WHERE t.announcement_id=a.announcement_id AND t.site_id=ANY($2::uuid[])))`;
    const rows = (await this.database.query(
      `SELECT ${fields} FROM dorify.dori_announcement a WHERE ${predicate} ORDER BY a.created_at DESC,a.announcement_id DESC LIMIT $3 OFFSET $4`,
      [scope, allowedSiteIds ?? null, pageSize, (page - 1) * pageSize],
    )) as AnnouncementRow[];
    const [count] = (await this.database.query(
      `SELECT count(*)::int AS total FROM dorify.dori_announcement a WHERE ${predicate}`,
      [scope, allowedSiteIds ?? null],
    )) as Array<{ total: number }>;
    return {
      items: rows.map((row) => adminAnnouncement(row, now, allowedSiteIds)),
      total: count.total,
      observedAt: now.toISOString(),
      page,
      pageSize,
    };
  }
  async find(id: string, now: Date) {
    const [row] = (await this.database.query(
      `SELECT ${fields} FROM dorify.dori_announcement a WHERE a.announcement_id=$1`,
      [id],
    )) as AnnouncementRow[];
    return row ? adminAnnouncement(row, now) : null;
  }
  async withdraw(id: string, now: Date): Promise<boolean> {
    return (
      returningRows(
        await this.database.query(
          `UPDATE dorify.dori_announcement SET withdrawn_at=COALESCE(withdrawn_at,$2),updated_at=$2 WHERE announcement_id=$1 RETURNING announcement_id`,
          [id, now],
        ),
      ).length > 0
    );
  }
  async forAgent(
    installationId: string,
    now: Date,
  ): Promise<AnnouncementItemDto[]> {
    const rows = (await this.database.query(
      `SELECT a.* FROM dorify.dori_announcement a JOIN dorify.dori_announcement_installation t USING(announcement_id) WHERE a.scope='installations' AND t.installation_id=$1 AND a.withdrawn_at IS NULL AND a.ends_at>$2 ORDER BY a.created_at,a.announcement_id LIMIT 50`,
      [installationId, now],
    )) as AnnouncementRow[];
    return rows.map(publicAnnouncement);
  }
  async forSite(siteId: string, now: Date): Promise<AnnouncementItemDto[]> {
    const rows = (await this.database.query(
      `SELECT a.* FROM dorify.dori_announcement a JOIN dorify.dori_announcement_site t USING(announcement_id) JOIN dorify.dori_site s ON s.site_id=t.site_id WHERE a.scope='sites' AND t.site_id=$1 AND s.is_active=TRUE AND a.withdrawn_at IS NULL AND a.ends_at>$2 ORDER BY a.created_at,a.announcement_id LIMIT 50`,
      [siteId, now],
    )) as AnnouncementRow[];
    return rows.map(publicAnnouncement);
  }
}
