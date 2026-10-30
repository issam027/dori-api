CREATE TABLE IF NOT EXISTS dorify.dori_edge_installation (
  installation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_name VARCHAR(200) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  credential_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (credential_status IN ('active', 'revoked')),
  last_seen_at TIMESTAMPTZ,
  last_heartbeat JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dorify.dori_edge_command (
  command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL
    REFERENCES dorify.dori_edge_installation (installation_id) ON DELETE CASCADE,
  command_type VARCHAR(40) NOT NULL
    CHECK (command_type IN ('RUN_HEALTH_CHECK', 'SYNC_NOW')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  command_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (command_status IN ('pending', 'acknowledged', 'succeeded', 'failed', 'expired')),
  result JSONB,
  error_message VARCHAR(1000),
  created_by_user_id UUID REFERENCES dorify.dori_user (user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_installation_last_seen
  ON dorify.dori_edge_installation (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_command_installation_created
  ON dorify.dori_edge_command (installation_id, created_at, command_id);

COMMENT ON TABLE dorify.dori_edge_installation IS
  'Cloud inventory and credentials for autonomous Dorify intra installations.';

COMMENT ON TABLE dorify.dori_edge_command IS
  'Allow-listed operational commands pulled by outbound-only Dorify agents.';
