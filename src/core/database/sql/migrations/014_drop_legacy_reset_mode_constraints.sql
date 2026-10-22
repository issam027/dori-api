-- Some databases were created before dori_site_queue_thread was renamed to
-- dori_queue. PostgreSQL preserves constraint names during a table rename, so
-- migration 013 could not remove this legacy check by its current table name.
ALTER TABLE dori_queue
  DROP CONSTRAINT IF EXISTS dori_site_queue_thread_daily_reset_mode_check;
