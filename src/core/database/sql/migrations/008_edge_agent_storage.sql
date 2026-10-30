CREATE SCHEMA IF NOT EXISTS dorify_agent;

CREATE TABLE IF NOT EXISTS dorify_agent.agent_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dorify_agent.command_inbox (
  command_id UUID PRIMARY KEY,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  result JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_command_inbox_status_received
  ON dorify_agent.command_inbox (status, received_at);

COMMENT ON SCHEMA dorify_agent IS
  'Durable local state for the outbound-only Dorify edge agent.';

COMMENT ON TABLE dorify_agent.agent_state IS
  'Agent cursors and other local synchronization state.';

COMMENT ON TABLE dorify_agent.command_inbox IS
  'Idempotent inbox and execution results for cloud supervision commands.';
