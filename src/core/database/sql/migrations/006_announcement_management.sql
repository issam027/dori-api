-- Preserve audit history while removing deleted announcements from administration and display.
ALTER TABLE dorify.dori_announcement ADD COLUMN deleted_at timestamptz;
CREATE TRIGGER realtime_announcement_site_removed AFTER DELETE ON dorify.dori_announcement_site FOR EACH ROW EXECUTE FUNCTION dorify.notify_announcement_change();
CREATE TRIGGER realtime_announcement_installation_removed AFTER DELETE ON dorify.dori_announcement_installation FOR EACH ROW EXECUTE FUNCTION dorify.notify_announcement_change();
