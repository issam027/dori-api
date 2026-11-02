-- Wake the outbound agent after commit; no token or personal data is broadcast.
-- Dirty tables remain the durable source of truth if a notification is missed.
CREATE OR REPLACE FUNCTION dorify_agent.notify_tracking_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('dorify_tracking_dirty', 'changed');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_tracking_dirty ON dorify_agent.tracking_dirty_queue;
CREATE TRIGGER notify_tracking_dirty AFTER INSERT OR UPDATE ON dorify_agent.tracking_dirty_queue
FOR EACH STATEMENT EXECUTE FUNCTION dorify_agent.notify_tracking_change();
