CREATE TABLE IF NOT EXISTS dorify.dori_realtime_outbox (
    event_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    event_type VARCHAR(40) NOT NULL
        CHECK (event_type IN ('queue_display_changed','queue_position_changed')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    last_error_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_pending
ON dorify.dori_realtime_outbox (created_at, event_id)
WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_replay
ON dorify.dori_realtime_outbox (queue_id, event_type, created_at, event_id);
