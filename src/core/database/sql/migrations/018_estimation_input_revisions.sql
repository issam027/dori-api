CREATE TABLE IF NOT EXISTS dorify.dori_queue_estimation_revision (
  queue_id UUID PRIMARY KEY REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 1,
  calculated_revision BIGINT NOT NULL DEFAULT 0
);
INSERT INTO dorify.dori_queue_estimation_revision(queue_id)
SELECT queue_id FROM dorify.dori_queue ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION dorify.mark_estimation_inputs_dirty() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP!='DELETE' THEN
    INSERT INTO dorify.dori_queue_estimation_revision(queue_id)
    SELECT DISTINCT queue_id FROM new_rows WHERE called_at IS NOT NULL
    ON CONFLICT(queue_id) DO UPDATE SET revision=dorify.dori_queue_estimation_revision.revision+1;
  END IF;
  IF TG_OP!='INSERT' THEN
    INSERT INTO dorify.dori_queue_estimation_revision(queue_id)
    SELECT DISTINCT r.queue_id FROM old_rows r
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id WHERE r.called_at IS NOT NULL
    ON CONFLICT(queue_id) DO UPDATE SET revision=dorify.dori_queue_estimation_revision.revision+1;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER estimation_registration_insert AFTER INSERT ON dorify.dori_registration
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();
CREATE TRIGGER estimation_registration_update AFTER UPDATE ON dorify.dori_registration
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT
EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();
CREATE TRIGGER estimation_registration_delete AFTER DELETE ON dorify.dori_registration
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT
EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();

CREATE INDEX IF NOT EXISTS idx_public_tracking_unsynced_live
ON dorify.dori_public_tracking_state
  ((CASE WHEN registration_status IN ('waiting','in_progress') THEN 0 ELSE 1 END), updated_at, tracking_token_hash)
WHERE sequence>cloud_synced_sequence;
