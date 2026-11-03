-- Notifications are commit-bound invalidations; projections/outbox remain durable truth.
CREATE FUNCTION dorify.notify_realtime_topic() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('dorify_realtime', json_build_object('key', 'queue:' || NEW.queue_id || ':' || NEW.event_type)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_topic_notify AFTER INSERT OR UPDATE ON dorify.dori_realtime_topic_state
FOR EACH ROW EXECUTE FUNCTION dorify.notify_realtime_topic();

CREATE FUNCTION dorify.notify_tracking_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    PERFORM pg_notify('dorify_realtime', json_build_object('key', 'tracking:' || OLD.tracking_token_hash)::text);
  ELSIF TG_OP='INSERT' OR ROW(NEW.sequence,NEW.language_preference,NEW.expires_at,NEW.source_installation_id)
       IS DISTINCT FROM ROW(OLD.sequence,OLD.language_preference,OLD.expires_at,OLD.source_installation_id) THEN
    PERFORM pg_notify('dorify_realtime', json_build_object('key', 'tracking:' || NEW.tracking_token_hash)::text);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_tracking_notify AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_public_tracking_state
FOR EACH ROW EXECUTE FUNCTION dorify.notify_tracking_projection();

-- Heartbeats extend connectivity timers in memory, without re-reading every ticket.
CREATE FUNCTION dorify.notify_installation_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('dorify_realtime', json_build_object(
    'key', 'installation:' || COALESCE(NEW.installation_id,OLD.installation_id),
    'seenAt', NEW.last_seen_at,
    'status', CASE WHEN TG_OP='DELETE' THEN 'revoked' ELSE NEW.deployment_status END)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_installation_notify AFTER INSERT OR DELETE OR UPDATE OF last_seen_at,deployment_status
ON dorify.dori_edge_installation FOR EACH ROW EXECUTE FUNCTION dorify.notify_installation_state();

CREATE FUNCTION dorify.notify_authorization_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('dorify_realtime', '{"key":"authorization"}');
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_user_security AFTER UPDATE OF is_active,deleted_at,password_hash OR DELETE
ON dorify.dori_user FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_session_security AFTER UPDATE OF revoked_at,revoked_reason,expires_at OR DELETE
ON dorify.dori_user_session FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_registration_security AFTER UPDATE OF is_active,registration_tracking_token,registration_tracking_token_valid_until,queue_id OR DELETE
ON dorify.dori_registration FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_queue_security AFTER UPDATE OR DELETE ON dorify.dori_queue
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_site_security AFTER UPDATE OR DELETE ON dorify.dori_site
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_user_site_security AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_user_site_assignment
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_user_queue_security AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_user_queue_assignment
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_user_role_security AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_user_role
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_role_permission_security AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_role_permission
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
CREATE TRIGGER realtime_role_security AFTER UPDATE OR DELETE ON dorify.dori_role
FOR EACH STATEMENT EXECUTE FUNCTION dorify.notify_authorization_change();
