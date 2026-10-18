-- Indexes supporting bounded monitoring series and live snapshots.
CREATE INDEX IF NOT EXISTS idx_registration_queue_created_at
  ON dori_registration (queue_id, created_at);

CREATE INDEX IF NOT EXISTS idx_registration_queue_served_at
  ON dori_registration (queue_id, served_at)
  WHERE served_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registration_queue_closed_at
  ON dori_registration (queue_id, closed_at)
  WHERE closed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registration_monitoring_dimensions
  ON dori_registration (queue_id, served_by_user_id, tier_id, status, entry_type);

CREATE INDEX IF NOT EXISTS idx_registration_live_queue_status
  ON dori_registration (queue_id, status, priority_reference_time)
  WHERE is_active = TRUE AND status IN ('waiting', 'in_progress');
