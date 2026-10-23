-- Append-only business audit trail. Application code only exposes INSERT.
-- Production database roles should additionally deny UPDATE/DELETE/TRUNCATE.
CREATE TABLE IF NOT EXISTS dori_audit_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id INT NULL REFERENCES dori_user(user_id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(128),
  secondary_target_id VARCHAR(128),
  outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('success', 'failure')),
  correlation_id VARCHAR(128),
  request_method VARCHAR(10) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  failure_type VARCHAR(100),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_event_actor_time
  ON dori_audit_event (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_target_time
  ON dori_audit_event (target_type, target_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_action_time
  ON dori_audit_event (action, occurred_at DESC);

-- Defense in depth: even an accidental repository or SQL change cannot alter
-- an audit event after insertion. A controlled retention operation must be run
-- by a database administrator after explicitly disabling this trigger.
CREATE OR REPLACE FUNCTION dori_reject_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'dori_audit_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_event_append_only ON dori_audit_event;
CREATE TRIGGER trg_audit_event_append_only
BEFORE UPDATE OR DELETE ON dori_audit_event
FOR EACH ROW EXECUTE FUNCTION dori_reject_audit_event_mutation();
