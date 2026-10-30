UPDATE dorify.dori_edge_installation
SET deployment_status = 'revoked', updated_at = CURRENT_TIMESTAMP
WHERE deployment_status = 'inactive';

ALTER TABLE dorify.dori_edge_installation
  DROP CONSTRAINT IF EXISTS dori_edge_installation_deployment_status_check;

ALTER TABLE dorify.dori_edge_installation
  ADD CONSTRAINT dori_edge_installation_deployment_status_check
  CHECK (deployment_status IN ('active', 'revoked'));

COMMENT ON COLUMN dorify.dori_edge_installation.deployment_status IS
  'Authoritative cloud lifecycle status. Revoked installations remain blocked locally until cloud reactivation.';
