ALTER TABLE dori_site
  ADD COLUMN IF NOT EXISTS default_working_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}';

ALTER TABLE dori_queue
  ADD COLUMN IF NOT EXISTS working_days INT[] NULL;
