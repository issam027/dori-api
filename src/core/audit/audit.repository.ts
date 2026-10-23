import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventQueryDto } from './dto/audit-query.dto';

export type AuditOutcome = 'success' | 'failure';

export interface AuditRecord {
  actorUserId: number | null;
  action: string;
  targetType: string;
  targetId: string | null;
  secondaryTargetId: string | null;
  outcome: AuditOutcome;
  correlationId: string | null;
  requestMethod: string;
  requestPath: string;
  failureType: string | null;
  siteScopeId: number | null;
}

export type AuditEventRow = Record<string, unknown> & {
  event_id: string;
  actor_user_id: number | null;
  actor_display_name: string | null;
  actor_username: string | null;
  actor_full_name: string | null;
  actor_user_type: string | null;
  actor_is_active: boolean | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_display_name: string | null;
  secondary_target_id: string | null;
  secondary_target_display_name: string | null;
  target_is_active: boolean | null;
  secondary_target_is_active: boolean | null;
  site_scope_id: number | null;
  site_scope_display_name: string | null;
  site_scope_location: string | null;
  site_scope_timezone: string | null;
  site_scope_is_active: boolean | null;
  outcome: AuditOutcome;
  correlation_id: string | null;
  request_method: string;
  request_path: string;
  failure_type: string | null;
  occurred_at: Date | string;
};

export const AUDIT_EVENT_READ_MODEL = `(
  SELECT ae.event_id, ae.actor_user_id,
    CASE
      WHEN actor.user_id IS NULL THEN NULL
      WHEN NULLIF(BTRIM(actor.full_name), '') IS NULL THEN actor.username
      ELSE actor.full_name || ' (' || actor.username || ')'
    END AS actor_display_name,
    actor.username AS actor_username,
    actor.full_name AS actor_full_name,
    actor.user_type AS actor_user_type,
    actor.is_active AS actor_is_active,
    ae.action, ae.target_type, ae.target_id,
    CASE ae.target_type
      WHEN 'user' THEN CASE
        WHEN target_user.user_id IS NULL THEN 'Utilisateur #' || ae.target_id
        WHEN NULLIF(BTRIM(target_user.full_name), '') IS NULL THEN target_user.username
        ELSE target_user.full_name || ' (' || target_user.username || ')'
      END
      WHEN 'site' THEN COALESCE(target_site.site_name, 'Site #' || ae.target_id)
      WHEN 'queue' THEN COALESCE(NULLIF(BTRIM(target_queue.queue_name), ''), target_queue.queue_code, 'File #' || ae.target_id)
      WHEN 'person' THEN COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', target_person.first_name, target_person.last_name)), ''), 'Personne #' || ae.target_id)
      WHEN 'role' THEN COALESCE(target_role.role_name, 'Rôle #' || ae.target_id)
      WHEN 'audit_event' THEN COALESCE('Événement ' || ae.target_id, 'Journal d’audit')
      ELSE CASE WHEN ae.target_id IS NULL THEN ae.target_type ELSE ae.target_type || ' #' || ae.target_id END
    END AS target_display_name,
    ae.secondary_target_id,
    CASE
      WHEN ae.secondary_target_id IS NULL THEN NULL
      WHEN ae.action IN ('user.role.assign', 'user.role.remove')
        THEN COALESCE(secondary_role.role_name, 'Rôle #' || ae.secondary_target_id)
      WHEN ae.action IN ('site.user.assign', 'site.user.remove', 'queue.operator.assign', 'queue.operator.remove')
        THEN CASE
          WHEN secondary_user.user_id IS NULL THEN 'Utilisateur #' || ae.secondary_target_id
          WHEN NULLIF(BTRIM(secondary_user.full_name), '') IS NULL THEN secondary_user.username
          ELSE secondary_user.full_name || ' (' || secondary_user.username || ')'
        END
      WHEN ae.action LIKE 'person.note.%' THEN 'Note #' || ae.secondary_target_id
      ELSE ae.secondary_target_id
    END AS secondary_target_display_name,
    CASE ae.target_type
      WHEN 'user' THEN target_user.is_active
      WHEN 'site' THEN target_site.is_active
      WHEN 'queue' THEN target_queue.is_active
      WHEN 'person' THEN target_person.is_active
      WHEN 'role' THEN target_role.is_active
      ELSE NULL
    END AS target_is_active,
    CASE
      WHEN ae.action IN ('user.role.assign', 'user.role.remove') THEN secondary_role.is_active
      WHEN ae.action IN ('site.user.assign', 'site.user.remove', 'queue.operator.assign', 'queue.operator.remove') THEN secondary_user.is_active
      ELSE NULL
    END AS secondary_target_is_active,
    ae.site_scope_id,
    scope_site.site_name AS site_scope_display_name,
    scope_site.site_location AS site_scope_location,
    scope_site.timezone AS site_scope_timezone,
    scope_site.is_active AS site_scope_is_active,
    ae.outcome, ae.correlation_id, ae.request_method, ae.request_path,
    ae.failure_type, ae.occurred_at
  FROM dori_audit_event ae
  LEFT JOIN dori_user actor ON actor.user_id = ae.actor_user_id
  LEFT JOIN dori_site scope_site ON scope_site.site_id = ae.site_scope_id
  LEFT JOIN dori_user target_user ON ae.target_type = 'user'
    AND target_user.user_id = CASE WHEN ae.target_id ~ '^[0-9]+$' THEN ae.target_id::int END
  LEFT JOIN dori_site target_site ON ae.target_type = 'site'
    AND target_site.site_id = CASE WHEN ae.target_id ~ '^[0-9]+$' THEN ae.target_id::int END
  LEFT JOIN dori_queue target_queue ON ae.target_type = 'queue'
    AND target_queue.queue_id = CASE WHEN ae.target_id ~ '^[0-9]+$' THEN ae.target_id::int END
  LEFT JOIN dori_person target_person ON ae.target_type = 'person'
    AND target_person.person_id = CASE WHEN ae.target_id ~ '^[0-9]+$' THEN ae.target_id::int END
  LEFT JOIN dori_role target_role ON ae.target_type = 'role'
    AND target_role.role_id = CASE WHEN ae.target_id ~ '^[0-9]+$' THEN ae.target_id::int END
  LEFT JOIN dori_role secondary_role ON ae.action IN ('user.role.assign', 'user.role.remove')
    AND secondary_role.role_id = CASE WHEN ae.secondary_target_id ~ '^[0-9]+$' THEN ae.secondary_target_id::int END
  LEFT JOIN dori_user secondary_user
    ON ae.action IN ('site.user.assign', 'site.user.remove', 'queue.operator.assign', 'queue.operator.remove')
    AND secondary_user.user_id = CASE WHEN ae.secondary_target_id ~ '^[0-9]+$' THEN ae.secondary_target_id::int END
) audit_view`;

export interface AuditSearchQuery {
  filter: AuditEventQueryDto;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
  allowedSiteIds?: number[];
}

@Injectable()
export class AuditRepository {
  constructor(private readonly dataSource: DataSource) {}

  async append(record: AuditRecord): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO dori_audit_event
        (actor_user_id, action, target_type, target_id, secondary_target_id,
         outcome, correlation_id, request_method, request_path, failure_type,
         site_scope_id)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         COALESCE(
           $11,
           CASE
             WHEN $3 = 'site' AND $4 ~ '^[0-9]+$' THEN
               (SELECT site_id FROM dori_site WHERE site_id = $4::int)
             WHEN $3 = 'queue' AND $4 ~ '^[0-9]+$' THEN
               (SELECT site_id FROM dori_queue WHERE queue_id = $4::int)
             WHEN $3 = 'person' AND $4 ~ '^[0-9]+$' THEN
               (SELECT site_id FROM dori_person WHERE person_id = $4::int)
             WHEN $3 = 'audit_event' AND $4 ~ '^[0-9a-fA-F-]{36}$' THEN
               (SELECT site_scope_id FROM dori_audit_event WHERE event_id = $4::uuid)
             ELSE NULL
           END
         )`,
      [
        record.actorUserId,
        record.action,
        record.targetType,
        record.targetId,
        record.secondaryTargetId,
        record.outcome,
        record.correlationId,
        record.requestMethod,
        record.requestPath,
        record.failureType,
        record.siteScopeId,
      ],
    );
  }

  async search(
    query: AuditSearchQuery,
  ): Promise<{ items: AuditEventRow[]; total: number }> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    const exactFilters: Array<[unknown, string]> = [
      [query.filter.actorUserId, 'actor_user_id'],
      [query.filter.action, 'action'],
      [query.filter.targetType, 'target_type'],
      [query.filter.targetId, 'target_id'],
      [query.filter.outcome, 'outcome'],
      [query.filter.correlationId, 'correlation_id'],
      [query.filter.siteId, 'site_scope_id'],
    ];
    for (const [value, column] of exactFilters) {
      if (value !== undefined) {
        params.push(value);
        clauses.push(`${column} = $${params.length}`);
      }
    }
    if (query.allowedSiteIds) {
      params.push(query.allowedSiteIds);
      clauses.push(`site_scope_id = ANY($${params.length})`);
    }
    if (query.filter.dateFrom) {
      params.push(query.filter.dateFrom);
      clauses.push(`occurred_at >= $${params.length}::date`);
    }
    if (query.filter.dateTo) {
      params.push(query.filter.dateTo);
      clauses.push(
        `occurred_at < ($${params.length}::date + INTERVAL '1 day')`,
      );
    }
    if (query.filter.search) {
      params.push(`%${this.escapeLike(query.filter.search)}%`);
      clauses.push(`(
        action ILIKE $${params.length} ESCAPE '\\'
        OR target_type ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(target_id, '') ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(secondary_target_id, '') ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(correlation_id, '') ILIKE $${params.length} ESCAPE '\\'
        OR request_path ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(actor_display_name, '') ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(target_display_name, '') ILIKE $${params.length} ESCAPE '\\'
        OR COALESCE(secondary_target_display_name, '') ILIKE $${params.length} ESCAPE '\\'
      )`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM ${AUDIT_EVENT_READ_MODEL} ${where}`,
      params,
    );
    const items: AuditEventRow[] = await this.dataSource.query(
      `SELECT event_id, actor_user_id, actor_display_name, action, target_type,
              target_id, target_display_name, secondary_target_id,
              secondary_target_display_name, site_scope_id,
              site_scope_display_name, outcome, correlation_id,
              request_method, request_path, failure_type, occurred_at
       FROM ${AUDIT_EVENT_READ_MODEL} ${where}
       ORDER BY ${query.sortField} ${query.sortOrder}, event_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async findById(
    eventId: string,
    allowedSiteIds?: number[],
  ): Promise<AuditEventRow | null> {
    const params: unknown[] = [eventId];
    const scopeClause = allowedSiteIds ? `AND site_scope_id = ANY($2)` : '';
    if (allowedSiteIds) params.push(allowedSiteIds);
    const rows: AuditEventRow[] = await this.dataSource.query(
      `SELECT event_id, actor_user_id, actor_display_name, actor_username,
              actor_full_name, actor_user_type, actor_is_active, action, target_type,
              target_id, target_display_name, secondary_target_id,
              secondary_target_display_name, target_is_active,
              secondary_target_is_active, site_scope_id,
              site_scope_display_name, site_scope_location,
              site_scope_timezone, site_scope_is_active, outcome,
              correlation_id, request_method, request_path, failure_type,
              occurred_at
       FROM ${AUDIT_EVENT_READ_MODEL}
       WHERE event_id = $1 ${scopeClause}`,
      params,
    );
    return rows[0] ?? null;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
