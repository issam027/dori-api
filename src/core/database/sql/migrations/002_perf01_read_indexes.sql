-- PERF-01: indexes for high-volume paginated reads.
-- CONCURRENTLY is intentionally omitted because migrations run transactionally.

CREATE INDEX IF NOT EXISTS idx_registration_queue_business_created_active
ON dorify.dori_registration (queue_id, business_date, created_at DESC)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_notification_created_registration
ON dorify.dori_notification (created_at DESC, registration_id);

ANALYZE dorify.dori_registration;
ANALYZE dorify.dori_notification;
