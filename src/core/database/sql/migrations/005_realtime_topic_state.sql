CREATE TABLE IF NOT EXISTS dorify.dori_realtime_topic_state (
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    event_type VARCHAR(40) NOT NULL
        CHECK (event_type IN ('queue_display_changed','queue_position_changed')),
    version BIGINT NOT NULL DEFAULT 1,
    event_id UUID NOT NULL REFERENCES dorify.dori_realtime_outbox(event_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, event_type)
);

WITH latest AS (
    SELECT DISTINCT ON (queue_id, event_type)
           queue_id, event_type, event_id, created_at
    FROM dorify.dori_realtime_outbox
    ORDER BY queue_id, event_type, created_at DESC, event_id DESC
)
INSERT INTO dorify.dori_realtime_topic_state
    (queue_id, event_type, version, event_id, updated_at)
SELECT queue_id, event_type, 1, event_id, created_at
FROM latest
ON CONFLICT (queue_id, event_type) DO NOTHING;
