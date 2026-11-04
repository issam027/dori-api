-- Durable operational notices, targeted to registered installations or local sites.
CREATE TABLE dorify.dori_announcement (
  announcement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(20) NOT NULL CHECK (scope IN ('installations','sites')),
  title varchar(120) NOT NULL CHECK (length(btrim(title)) > 0),
  message varchar(2000) NOT NULL CHECK (length(btrim(message)) > 0),
  severity varchar(10) NOT NULL CHECK (severity IN ('info','warning','critical')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES dorify.dori_user(user_id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at),
  CHECK (ends_at <= starts_at + INTERVAL '30 days')
);
CREATE TABLE dorify.dori_announcement_installation (
  announcement_id uuid NOT NULL REFERENCES dorify.dori_announcement(announcement_id),
  installation_id uuid NOT NULL REFERENCES dorify.dori_edge_installation(installation_id),
  PRIMARY KEY (announcement_id, installation_id)
);
CREATE TABLE dorify.dori_announcement_site (
  announcement_id uuid NOT NULL REFERENCES dorify.dori_announcement(announcement_id),
  site_id uuid NOT NULL REFERENCES dorify.dori_site(site_id),
  PRIMARY KEY (announcement_id,site_id)
);
CREATE INDEX announcement_installation_lookup ON dorify.dori_announcement_installation(installation_id,announcement_id);
CREATE INDEX announcement_site_lookup ON dorify.dori_announcement_site(site_id,announcement_id);
CREATE INDEX announcement_recent ON dorify.dori_announcement(scope,created_at DESC,announcement_id DESC);
CREATE INDEX announcement_live ON dorify.dori_announcement(ends_at,starts_at) WHERE withdrawn_at IS NULL;
CREATE FUNCTION dorify.notify_announcement_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('dorify_realtime','{"key":"announcements"}');
  PERFORM pg_notify('dorify_realtime','{"key":"edge-installations"}');
  RETURN NULL;
END $$;
CREATE TRIGGER realtime_announcement AFTER INSERT OR UPDATE ON dorify.dori_announcement FOR EACH ROW EXECUTE FUNCTION dorify.notify_announcement_change();
CREATE TRIGGER realtime_announcement_installation AFTER INSERT ON dorify.dori_announcement_installation FOR EACH ROW EXECUTE FUNCTION dorify.notify_announcement_change();
CREATE TRIGGER realtime_announcement_site AFTER INSERT ON dorify.dori_announcement_site FOR EACH ROW EXECUTE FUNCTION dorify.notify_announcement_change();
