ALTER TABLE dorify.dori_realtime_outbox
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

DROP INDEX IF EXISTS dorify.idx_realtime_outbox_pending;

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_pending
ON dorify.dori_realtime_outbox (COALESCE(next_attempt_at, created_at), created_at, event_id)
WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_published_cleanup
ON dorify.dori_realtime_outbox (published_at)
WHERE published_at IS NOT NULL;
