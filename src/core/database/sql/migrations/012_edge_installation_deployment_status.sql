ALTER TABLE dorify.dori_edge_installation
  ADD COLUMN IF NOT EXISTS deployment_type VARCHAR(20) NOT NULL DEFAULT 'intra'
    CHECK (deployment_type IN ('intra')),
  ADD COLUMN IF NOT EXISTS deployment_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (deployment_status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS idx_edge_installation_deployment_status
  ON dorify.dori_edge_installation (deployment_status, installation_name);

COMMENT ON COLUMN dorify.dori_edge_installation.deployment_type IS
  'Deployment category managed by the cloud control plane.';

COMMENT ON COLUMN dorify.dori_edge_installation.deployment_status IS
  'Administrative lifecycle status checked by the intra agent; local operation remains autonomous.';
