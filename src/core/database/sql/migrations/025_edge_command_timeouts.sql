ALTER TABLE dorify.dori_edge_command
  DROP CONSTRAINT dori_edge_command_command_status_check;

UPDATE dorify.dori_edge_command
SET command_status = 'timedOut'
WHERE command_status = 'expired';

ALTER TABLE dorify.dori_edge_command
  ADD CONSTRAINT dori_edge_command_command_status_check
  CHECK (command_status IN ('pending', 'acknowledged', 'succeeded', 'failed', 'timedOut'));

CREATE INDEX idx_edge_command_pending_expiry
  ON dorify.dori_edge_command (expires_at, installation_id)
  WHERE command_status IN ('pending', 'acknowledged');

UPDATE dorify.dori_edge_command
SET command_status = 'timedOut', completed_at = expires_at
WHERE command_status IN ('pending', 'acknowledged')
  AND expires_at <= CURRENT_TIMESTAMP;
