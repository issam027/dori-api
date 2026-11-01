-- Bound empty notification scans while retaining processing-lease recovery.
CREATE INDEX IF NOT EXISTS idx_notification_direct_pending
ON dorify.dori_notification (created_at, notification_id)
WHERE dispatch_route = 'direct' AND notification_status IN ('pending', 'processing');

