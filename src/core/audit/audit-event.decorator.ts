import { SetMetadata } from '@nestjs/common';

export const AUDIT_EVENT_KEY = 'dori:audit-event';

export interface AuditEventDefinition {
  action: string;
  targetType: string;
  targetParam?: string;
  /** Allowlisted scalar identifier extracted from a successful response. */
  targetResponseField?: string;
  secondaryTargetParam?: string;
  /** Allowlisted scalar identifier only; the request body is never persisted. */
  secondaryTargetBodyField?: string;
  /** Allowlisted numeric site identifier extracted from the query string. */
  siteScopeQueryField?: string;
}

export const AuditEvent = (definition: AuditEventDefinition) =>
  SetMetadata(AUDIT_EVENT_KEY, definition);
