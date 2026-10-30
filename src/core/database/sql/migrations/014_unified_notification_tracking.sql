ALTER TABLE dorify.dori_notification
  ALTER COLUMN registration_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_installation_id UUID
    REFERENCES dorify.dori_edge_installation(installation_id),
  ADD COLUMN IF NOT EXISTS source_registration_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_route VARCHAR(20) NOT NULL DEFAULT 'direct';

ALTER TABLE dorify.dori_notification
  DROP CONSTRAINT IF EXISTS ck_notification_status,
  DROP CONSTRAINT IF EXISTS ck_notification_dispatch_route,
  DROP CONSTRAINT IF EXISTS ck_notification_origin;

ALTER TABLE dorify.dori_notification
  ADD CONSTRAINT ck_notification_status CHECK (
    notification_status IN ('pending','processing','sent','delivered','failed','skipped_offline')
  ),
  ADD CONSTRAINT ck_notification_dispatch_route CHECK (
    dispatch_route IN ('direct','cloud_relay','disabled_offline')
  ),
  ADD CONSTRAINT ck_notification_origin CHECK (
    (registration_id IS NOT NULL AND source_installation_id IS NULL)
    OR
    (registration_id IS NULL AND source_installation_id IS NOT NULL AND source_registration_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_edge_source
  ON dorify.dori_notification (source_installation_id, notification_id)
  WHERE source_installation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_cloud_relay_pending
  ON dorify.dori_notification (created_at, notification_id)
  WHERE dispatch_route='cloud_relay' AND notification_status='pending';

CREATE TABLE IF NOT EXISTS dorify.dori_public_tracking_state (
  tracking_token_hash CHAR(64) PRIMARY KEY,
  registration_id UUID REFERENCES dorify.dori_registration(registration_id) ON DELETE CASCADE,
  source_installation_id UUID REFERENCES dorify.dori_edge_installation(installation_id),
  source_registration_id UUID,
  sequence BIGINT NOT NULL DEFAULT 1 CHECK (sequence > 0),
  cloud_synced_sequence BIGINT NOT NULL DEFAULT 0 CHECK (cloud_synced_sequence >= 0),
  ticket_number VARCHAR(14),
  registration_status VARCHAR(20) NOT NULL,
  position INT,
  estimated_wait_minutes INT,
  counter_name VARCHAR(100),
  queue_public_name VARCHAR(200),
  observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_public_tracking_origin CHECK (
    (registration_id IS NOT NULL AND source_installation_id IS NULL)
    OR
    (registration_id IS NULL AND source_installation_id IS NOT NULL AND source_registration_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_unsynced
  ON dorify.dori_public_tracking_state (updated_at, tracking_token_hash)
  WHERE sequence > cloud_synced_sequence;

CREATE INDEX IF NOT EXISTS idx_public_tracking_expiry
  ON dorify.dori_public_tracking_state (expires_at);

COMMENT ON TABLE dorify.dori_public_tracking_state IS
  'Universal public tracking read model used by cloud-native and relayed intra registrations.';
