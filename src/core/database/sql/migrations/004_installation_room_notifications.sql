-- Inventory/commands invalidate the administration room without scanning signatures.
CREATE FUNCTION dorify.notify_installation_room() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='dori_edge_command' THEN
    PERFORM pg_notify('dorify_realtime', json_build_object(
      'key','edge-installations',
      'commandId',COALESCE(NEW.command_id,OLD.command_id),
      'expiresAt',CASE WHEN TG_OP!='DELETE' AND NEW.command_status IN ('pending','acknowledged') THEN NEW.expires_at ELSE NULL END)::text);
  ELSE
    PERFORM pg_notify('dorify_realtime','{"key":"edge-installations"}');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_installation_room AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_edge_installation
FOR EACH ROW EXECUTE FUNCTION dorify.notify_installation_room();
CREATE TRIGGER realtime_command_room AFTER INSERT OR UPDATE OR DELETE ON dorify.dori_edge_command
FOR EACH ROW EXECUTE FUNCTION dorify.notify_installation_room();
