import { SetMetadata } from '@nestjs/common';

export const AUDIT_EVENT_KEY = 'dori:audit-event';

export interface AuditEventDefinition {
  action: string;
  targetType: string;
  targetParam?: string;
  secondaryTargetParam?: string;
  /** Allowlisted scalar identifier only; the request body is never persisted. */
  secondaryTargetBodyField?: string;
}

export const AuditEvent = (definition: AuditEventDefinition) =>
  SetMetadata(AUDIT_EVENT_KEY, definition);
