export type AuditOutcome = 'success' | 'failure';

export interface AuditFilter {
  siteId?: string;
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  correlationId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
