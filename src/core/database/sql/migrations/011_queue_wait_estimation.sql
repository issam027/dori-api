UPDATE dori_registration
SET checked_in_at = COALESCE(priority_reference_time, created_at)
WHERE entry_type = 'walkin' AND checked_in_at IS NULL;

CREATE TABLE IF NOT EXISTS dori_queue_estimation_stats (
  estimation_stats_id BIGSERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES dori_site(site_id),
  queue_id INT NOT NULL REFERENCES dori_queue(queue_id),
  activity_date DATE NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ended_at TIMESTAMPTZ NOT NULL,
  cycle_p50_minutes INT NULL CHECK (cycle_p50_minutes >= 0),
  cycle_p65_minutes INT NULL CHECK (cycle_p65_minutes >= 0),
  cycle_p90_minutes INT NULL CHECK (cycle_p90_minutes >= 0),
  wait_p50_minutes INT NULL CHECK (wait_p50_minutes >= 0),
  wait_p65_minutes INT NULL CHECK (wait_p65_minutes >= 0),
  wait_p90_minutes INT NULL CHECK (wait_p90_minutes >= 0),
  sample_size INT NOT NULL CHECK (sample_size >= 0),
  is_reliable BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_queue_estimation_stats_daily UNIQUE (site_id, queue_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_queue_estimation_stats_lookup
  ON dori_queue_estimation_stats (site_id, queue_id, activity_date, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_estimation_stats_reliable
  ON dori_queue_estimation_stats (site_id, queue_id, calculated_at DESC)
  WHERE is_reliable = TRUE;

ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS chk_registration_walkin_checked_in;
ALTER TABLE dori_registration ADD CONSTRAINT chk_registration_walkin_checked_in
  CHECK (entry_type <> 'walkin' OR checked_in_at IS NOT NULL) NOT VALID;
ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS chk_registration_called_after_checkin;
ALTER TABLE dori_registration ADD CONSTRAINT chk_registration_called_after_checkin
  CHECK (called_at IS NULL OR (checked_in_at IS NOT NULL AND called_at >= checked_in_at)) NOT VALID;
ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS chk_registration_checked_appointment_arrived;
ALTER TABLE dori_registration ADD CONSTRAINT chk_registration_checked_appointment_arrived
  CHECK (entry_type <> 'appointment' OR appointment_status <> 'checked_in' OR checked_in_at IS NOT NULL) NOT VALID;
ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS chk_registration_served_after_called;
ALTER TABLE dori_registration ADD CONSTRAINT chk_registration_served_after_called
  CHECK (served_at IS NULL OR (called_at IS NOT NULL AND served_at >= called_at)) NOT VALID;
ALTER TABLE dori_registration VALIDATE CONSTRAINT chk_registration_walkin_checked_in;
ALTER TABLE dori_registration VALIDATE CONSTRAINT chk_registration_called_after_checkin;
ALTER TABLE dori_registration VALIDATE CONSTRAINT chk_registration_checked_appointment_arrived;
ALTER TABLE dori_registration VALIDATE CONSTRAINT chk_registration_served_after_called;
