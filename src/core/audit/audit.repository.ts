import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
}

@Injectable()
export class AuditRepository {
  constructor(private readonly dataSource: DataSource) {}

  async append(record: AuditRecord): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO dori_audit_event
        (actor_user_id, action, target_type, target_id, secondary_target_id,
         outcome, correlation_id, request_method, request_path, failure_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
      ],
    );
  }
}
