import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DoriException } from '../../core/errors/dori.exception';
import { returningRows } from '../../core/database/returning-rows';
import {
  CreateAnnouncementDto,
  AnnouncementResponseDto,
  AnnouncementItemDto,
  AnnouncementScope,
  AnnouncementQueryDto,
  UpdateAnnouncementDto,
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
  updated_at: Date | string;
  withdrawn_at: Date | string | null;
  targets: AnnouncementResponseDto['targets'];
};
const fields = `a.*,CASE a.scope WHEN 'installations' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('targetId',i.installation_id,'name',i.installation_name) ORDER BY i.installation_name) FROM dorify.dori_announcement_installation t JOIN dorify.dori_edge_installation i USING(installation_id) WHERE t.announcement_id=a.announcement_id),'[]'::jsonb)
 ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('targetId',s.site_id,'name',s.site_name) ORDER BY s.site_name) FROM dorify.dori_announcement_site t JOIN dorify.dori_site s USING(site_id) WHERE t.announcement_id=a.announcement_id),'[]'::jsonb) END AS targets`;
export function publicAnnouncement(
  row: Omit<
    AnnouncementRow,
    'scope' | 'targets' | 'created_at' | 'updated_at' | 'withdrawn_at'
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
    row.scope !== 'sites' || allowedSiteIds === undefined
      ? undefined
      : new Set(allowedSiteIds);
  return {
    ...publicAnnouncement(row),
    scope: row.scope,
    canWithdraw:
      !row.withdrawn_at &&
      (!permitted || row.targets.every((t) => permitted.has(t.targetId))),
    canEdit:
      !row.withdrawn_at &&
      (!permitted || row.targets.every((t) => permitted.has(t.targetId))),
    updatedAt: new Date(row.updated_at ?? row.created_at).toISOString(),
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
      const { relation, id } = await this.validateTargets(
        transaction,
        body,
        now,
      );
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
  private async validateTargets(
    transaction: EntityManager,
    body: Pick<CreateAnnouncementDto, 'scope' | 'targetIds'>,
    now: Date,
    excludingId?: string,
  ) {
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
      `SELECT t.${id} FROM ${relation} t JOIN dorify.dori_announcement a USING(announcement_id) WHERE t.${id}=ANY($1::uuid[]) AND a.withdrawn_at IS NULL AND a.ends_at>$2 AND ($3::uuid IS NULL OR a.announcement_id<>$3) GROUP BY t.${id} HAVING count(*)>=50`,
      [body.targetIds, now, excludingId ?? null],
    )) as object[];
    if (full.length) throw new DoriException('CONFLICT');

    return { relation, id };
  }
  async list(
    scope: AnnouncementScope | AnnouncementScope[],
    page: number,
    pageSize: number,
    now: Date,
    allowedSiteIds?: string[],
    query: Partial<AnnouncementQueryDto> = {},
  ) {
    let predicate = `a.scope=ANY($1::varchar[]) AND (a.scope='installations' OR $2::uuid[] IS NULL OR EXISTS(SELECT 1 FROM dorify.dori_announcement_site t WHERE t.announcement_id=a.announcement_id AND t.site_id=ANY($2::uuid[])))`;
    const params: unknown[] = [
      typeof scope === 'string' ? [scope] : scope,
      allowedSiteIds ?? null,
    ];
    const add = (value: unknown) => {
      params.push(value);
      return '$' + params.length;
    };
    if (query.search) {
      const parameter = add(
        '%' + query.search.replace(/[\\%_]/g, '\\$&') + '%',
      );
      predicate += ` AND (a.title ILIKE ${parameter} OR a.message ILIKE ${parameter})`;
    }
    if (query.severity) predicate += ' AND a.severity=' + add(query.severity);
    if (query.targetId) {
      const target = add(query.targetId);
      predicate += ` AND ((a.scope='sites' AND EXISTS(SELECT 1 FROM dorify.dori_announcement_site ft WHERE ft.announcement_id=a.announcement_id AND ft.site_id=${target})) OR (a.scope='installations' AND EXISTS(SELECT 1 FROM dorify.dori_announcement_installation ft WHERE ft.announcement_id=a.announcement_id AND ft.installation_id=${target})))`;
    }
    if (query.dateFrom) predicate += ' AND a.ends_at>=' + add(query.dateFrom);
    if (query.dateTo) predicate += ' AND a.starts_at<=' + add(query.dateTo);
    if (query.status) {
      const timestamp = add(now);
      predicate += ` AND (CASE WHEN a.withdrawn_at IS NOT NULL THEN 'withdrawn' WHEN a.ends_at<=${timestamp} THEN 'expired' WHEN a.starts_at>${timestamp} THEN 'scheduled' ELSE 'active' END)=${add(query.status)}`;
    }
    const sorts: Record<string, string> = {
      'createdAt:desc': 'a.created_at DESC',
      'createdAt:asc': 'a.created_at ASC',
      'title:asc': 'a.title ASC',
      'title:desc': 'a.title DESC',
      'startsAt:asc': 'a.starts_at ASC',
      'startsAt:desc': 'a.starts_at DESC',
      'endsAt:asc': 'a.ends_at ASC',
      'endsAt:desc': 'a.ends_at DESC',
    };
    const order =
      sorts[query.sort ?? 'createdAt:desc'] ?? sorts['createdAt:desc'];
    const rows = (await this.database.query(
      `SELECT ${fields} FROM dorify.dori_announcement a WHERE ${predicate} ORDER BY ${order},a.announcement_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    )) as AnnouncementRow[];
    const [count] = (await this.database.query(
      `SELECT count(*)::int AS total FROM dorify.dori_announcement a WHERE ${predicate}`,
      params,
    )) as Array<{ total: number }>;
    return {
      items: rows.map((row) => adminAnnouncement(row, now, allowedSiteIds)),
      total: count.total,
      observedAt: now.toISOString(),
      page,
      pageSize,
      totalPages: Math.ceil(count.total / pageSize),
    };
  }
  async find(
    id: string,
    now: Date,
    database: Pick<DataSource, 'query'> = this.database,
    allowedSiteIds?: string[],
  ) {
    const [row] = (await database.query(
      `SELECT ${fields} FROM dorify.dori_announcement a WHERE a.announcement_id=$1`,
      [id],
    )) as AnnouncementRow[];
    return row ? adminAnnouncement(row, now, allowedSiteIds) : null;
  }
  async withdraw(
    id: string,
    now: Date,
    allowedSiteIds?: string[],
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      await this.locked(transaction, id, now, allowedSiteIds);
      return (
        returningRows(
          await transaction.query(
            `UPDATE dorify.dori_announcement SET withdrawn_at=COALESCE(withdrawn_at,$2),updated_at=$2 WHERE announcement_id=$1 RETURNING announcement_id`,
            [id, now],
          ),
        ).length > 0
      );
    });
  }
  private async locked(
    transaction: EntityManager,
    announcementId: string,
    now: Date,
    allowedSiteIds?: string[],
  ) {
    await transaction.query(
      "SELECT pg_advisory_xact_lock(hashtext('dorify:announcements'))",
    );
    await transaction.query(
      'SELECT announcement_id FROM dorify.dori_announcement WHERE announcement_id=$1 FOR UPDATE',
      [announcementId],
    );
    const current = await this.find(announcementId, now, transaction);
    if (
      !current ||
      (allowedSiteIds &&
        current.targets.some((t) => !allowedSiteIds.includes(t.targetId)))
    )
      throw new DoriException('RESOURCE_NOT_FOUND');
    return current;
  }
  async update(
    announcementId: string,
    body: UpdateAnnouncementDto,
    now: Date,
    allowedSiteIds?: string[],
  ) {
    return this.database.transaction(async (transaction) => {
      const current = await this.locked(
        transaction,
        announcementId,
        now,
        allowedSiteIds,
      );
      if (current.status === 'withdrawn') throw new DoriException('CONFLICT');
      if (
        allowedSiteIds &&
        body.targetIds.some((id) => !allowedSiteIds.includes(id))
      )
        throw new DoriException('RESOURCE_NOT_FOUND');
      const { relation, id } = await this.validateTargets(
        transaction,
        { scope: current.scope, targetIds: body.targetIds },
        now,
        announcementId,
      );
      await transaction.query(
        'UPDATE dorify.dori_announcement SET title=$2,message=$3,severity=$4,starts_at=$5,ends_at=$6,updated_at=$7 WHERE announcement_id=$1',
        [
          announcementId,
          body.title,
          body.message,
          body.severity,
          body.startsAt ?? current.startsAt,
          body.endsAt,
          now,
        ],
      );
      await transaction.query(
        `DELETE FROM ${relation} WHERE announcement_id=$1`,
        [announcementId],
      );
      await transaction.query(
        `INSERT INTO ${relation}(announcement_id,${id}) SELECT $1,unnest($2::uuid[])`,
        [announcementId, body.targetIds],
      );
      return (await this.find(announcementId, now, transaction))!;
    });
  }
  async nextBoundary(now: Date): Promise<number | undefined> {
    const [row] = (await this.database.query(
      `SELECT min(boundary) AS boundary FROM (
        SELECT starts_at AS boundary FROM dorify.dori_announcement WHERE withdrawn_at IS NULL AND starts_at>$1
        UNION ALL SELECT ends_at FROM dorify.dori_announcement WHERE withdrawn_at IS NULL AND ends_at>$1
      ) periods`,
      [now],
    )) as Array<{ boundary: Date | null }>;
    return row.boundary ? new Date(row.boundary).getTime() : undefined;
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
