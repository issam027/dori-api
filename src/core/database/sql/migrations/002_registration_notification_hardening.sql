-- Upgrade existing installations to the terminal registration/notification model.

ALTER TABLE dori_registration
    ADD COLUMN IF NOT EXISTS served_by_user_id INT REFERENCES dori_user(user_id);

UPDATE dori_registration r
SET served_by_user_id = s.user_id
FROM dori_operator_session s
WHERE r.served_by_session_id = s.session_id
  AND r.served_by_user_id IS NULL;

UPDATE dori_registration
SET is_active = TRUE, deleted_at = NULL
WHERE status IN ('served','no_show','expired','cancelled') AND is_active = FALSE;

ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS ck_registration_served_by_pair;
ALTER TABLE dori_registration ADD CONSTRAINT ck_registration_served_by_pair CHECK (
    (served_by_session_id IS NULL AND served_by_user_id IS NULL)
    OR (served_by_session_id IS NOT NULL AND served_by_user_id IS NOT NULL)
);

ALTER TABLE dori_registration DROP CONSTRAINT IF EXISTS ck_registration_served_by_status;
ALTER TABLE dori_registration ADD CONSTRAINT ck_registration_served_by_status CHECK (
    status NOT IN ('in_progress','served','no_show')
    OR (served_by_session_id IS NOT NULL AND served_by_user_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION dori_check_registration_served_by() RETURNS trigger AS $$
DECLARE session_user_id INT;
BEGIN
    IF NEW.served_by_session_id IS NULL THEN RETURN NEW; END IF;
    SELECT user_id INTO session_user_id FROM dori_operator_session
    WHERE session_id = NEW.served_by_session_id;
    IF session_user_id IS NULL OR session_user_id <> NEW.served_by_user_id THEN
        RAISE EXCEPTION 'served_by_user_id % does not own session %',
            NEW.served_by_user_id, NEW.served_by_session_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_served_by ON dori_registration;
CREATE CONSTRAINT TRIGGER trg_registration_served_by
AFTER INSERT OR UPDATE OF served_by_session_id, served_by_user_id ON dori_registration
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dori_check_registration_served_by();

ALTER TABLE dori_notification ALTER COLUMN recipient DROP NOT NULL;
ALTER TABLE dori_notification ALTER COLUMN notification_content DROP NOT NULL;
UPDATE dori_notification SET failure_reason = 'LEGACY_FAILURE'
WHERE notification_status = 'failed' AND failure_reason IS NULL;
UPDATE dori_notification
SET notification_status = 'failed',
    failure_reason = CASE
        WHEN recipient IS NULL THEN 'LEGACY_RECIPIENT_MISSING'
        ELSE 'LEGACY_CONTENT_MISSING'
    END
WHERE notification_status <> 'failed'
  AND (recipient IS NULL OR notification_content IS NULL);

ALTER TABLE dori_notification DROP CONSTRAINT IF EXISTS ck_notification_dispatchable;
ALTER TABLE dori_notification ADD CONSTRAINT ck_notification_dispatchable CHECK (
    (notification_status = 'failed' AND failure_reason IS NOT NULL)
    OR
    (notification_status <> 'failed' AND recipient IS NOT NULL AND notification_content IS NOT NULL)
);

WITH duplicates AS (
  SELECT notification_id,
         ROW_NUMBER() OVER (
           PARTITION BY registration_id, notification_type, channel
           ORDER BY created_at, notification_id
         ) AS row_number
  FROM dori_notification
)
DELETE FROM dori_notification n USING duplicates d
WHERE n.notification_id = d.notification_id AND d.row_number > 1;

DROP INDEX IF EXISTS uk_notification_once;
CREATE UNIQUE INDEX uk_notification_once
ON dori_notification (registration_id, notification_type, channel);
