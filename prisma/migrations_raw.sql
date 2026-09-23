-- =============================================================================
-- Triggers et Contraintes Additionnelles DORI (PostgreSQL)
-- =============================================================================

-- 1. Trigger automatique de mise à jour de updated_at (§3.17)
CREATE OR REPLACE FUNCTION dori_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger sur les tables portant updated_at
DROP TRIGGER IF EXISTS trg_site_updated_at ON dori_site;
CREATE TRIGGER trg_site_updated_at BEFORE UPDATE ON dori_site FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_queue_updated_at ON dori_site_queue_thread;
CREATE TRIGGER trg_queue_updated_at BEFORE UPDATE ON dori_site_queue_thread FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_person_updated_at ON dori_person;
CREATE TRIGGER trg_person_updated_at BEFORE UPDATE ON dori_person FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_person_note_updated_at ON dori_person_note;
CREATE TRIGGER trg_person_note_updated_at BEFORE UPDATE ON dori_person_note FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_service_tier_updated_at ON dori_service_tier;
CREATE TRIGGER trg_service_tier_updated_at BEFORE UPDATE ON dori_service_tier FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_queue_service_tier_updated_at ON dori_queue_service_tier;
CREATE TRIGGER trg_queue_service_tier_updated_at BEFORE UPDATE ON dori_queue_service_tier FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_tier_rule_updated_at ON dori_tier_notification_rule;
CREATE TRIGGER trg_tier_rule_updated_at BEFORE UPDATE ON dori_tier_notification_rule FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_updated_at ON dori_customer;
CREATE TRIGGER trg_customer_updated_at BEFORE UPDATE ON dori_customer FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_updated_at ON dori_notification;
CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON dori_notification FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_translation_updated_at ON dori_translation;
CREATE TRIGGER trg_translation_updated_at BEFORE UPDATE ON dori_translation FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_updated_at ON dori_user;
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON dori_user FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

-- 2. Index Partiels Uniques & Contraintes (§3.4, §3.9, §3.10, §3.12, §3.14)
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_email_active
    ON dori_person (LOWER(email)) WHERE email IS NOT NULL AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uk_person_phone_active
    ON dori_person (phone_number) WHERE phone_number IS NOT NULL AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_thread_active
    ON dori_queue_session (queue_id, thread_number)
    WHERE disconnected_at IS NULL AND thread_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_user_active
    ON dori_queue_session (queue_id, user_id)
    WHERE disconnected_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_person_open
    ON dori_customer (queue_id, person_id)
    WHERE status IN ('waiting','in_progress') AND is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_once
    ON dori_notification (customer_id, notification_type, channel)
    WHERE notification_status <> 'failed';

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_email_active
    ON dori_user (LOWER(email)) WHERE email IS NOT NULL AND is_active;
