-- Rename the ambiguous reset mode while preserving existing configuration.
ALTER TABLE dori_queue
  DROP CONSTRAINT IF EXISTS dori_queue_daily_reset_mode_check;
ALTER TABLE dori_site
  DROP CONSTRAINT IF EXISTS dori_site_default_daily_reset_mode_check;

UPDATE dori_queue
SET daily_reset_mode = 'carry_over_open'
WHERE daily_reset_mode = 'close_served_only';

UPDATE dori_site
SET default_daily_reset_mode = 'carry_over_open'
WHERE default_daily_reset_mode = 'close_served_only';

ALTER TABLE dori_queue
  ADD CONSTRAINT dori_queue_daily_reset_mode_check
  CHECK (daily_reset_mode IN ('close_all', 'carry_over_open'));
ALTER TABLE dori_site
  ADD CONSTRAINT dori_site_default_daily_reset_mode_check
  CHECK (default_daily_reset_mode IN ('close_all', 'carry_over_open'));
