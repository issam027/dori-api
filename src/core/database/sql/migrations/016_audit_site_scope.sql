ALTER TABLE dori_audit_event
  ADD COLUMN IF NOT EXISTS site_scope_id INT REFERENCES dori_site(site_id);

-- Migration 015 made the journal append-only. Temporarily disable its trigger
-- only for this controlled historical backfill.
ALTER TABLE dori_audit_event DISABLE TRIGGER trg_audit_event_append_only;

UPDATE dori_audit_event ae
SET site_scope_id = CASE
  WHEN ae.target_type = 'site' AND ae.target_id ~ '^[0-9]+$' THEN (
    SELECT site_id FROM dori_site WHERE site_id = ae.target_id::int
  )
  WHEN ae.target_type = 'queue' AND ae.target_id ~ '^[0-9]+$' THEN (
    SELECT site_id FROM dori_queue WHERE queue_id = ae.target_id::int
  )
  WHEN ae.target_type = 'person' AND ae.target_id ~ '^[0-9]+$' THEN (
    SELECT site_id FROM dori_person WHERE person_id = ae.target_id::int
  )
  WHEN ae.target_type = 'audit_event' AND ae.target_id ~ '^[0-9a-fA-F-]{36}$' THEN (
    SELECT site_scope_id FROM dori_audit_event WHERE event_id = ae.target_id::uuid
  )
  ELSE NULL
END
WHERE site_scope_id IS NULL;

ALTER TABLE dori_audit_event ENABLE TRIGGER trg_audit_event_append_only;

CREATE INDEX IF NOT EXISTS idx_audit_event_site_time
  ON dori_audit_event (site_scope_id, occurred_at DESC);
