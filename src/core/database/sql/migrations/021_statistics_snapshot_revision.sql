-- A queue can have several business dates still in use (carry-over or corrections).
-- Refreshing one date must not acknowledge stale statistics for another date.
ALTER TABLE dorify.dori_queue_estimation_stats
ADD COLUMN IF NOT EXISTS input_revision BIGINT NOT NULL DEFAULT 0;
