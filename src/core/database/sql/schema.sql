-- Extension required for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function for updated_at trigger (§3.17)
CREATE OR REPLACE FUNCTION dori_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. dori_site (§3.2)
CREATE TABLE IF NOT EXISTS dori_site (
    site_id SERIAL PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL,
    site_location VARCHAR(255),
    site_logo_url TEXT,
    site_type VARCHAR(50) NOT NULL DEFAULT 'public'
        CHECK (site_type IN ('public','private')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Tunis',
    default_currency CHAR(3) NOT NULL DEFAULT 'TND',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,

    default_appointments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    default_appointment_slot_duration INT NOT NULL DEFAULT 15,
    default_slot_capacity INT NOT NULL DEFAULT 1,
    default_working_hours_start TIME NOT NULL DEFAULT '08:00',
    default_working_hours_end TIME NOT NULL DEFAULT '17:00',
    default_break_start TIME DEFAULT '12:00',
    default_break_end TIME DEFAULT '14:00',
    default_late_tolerance_minutes INT NOT NULL DEFAULT 60,

    default_base_weight_walkin NUMERIC(10,2) NOT NULL DEFAULT 0,
    default_base_weight_appointment NUMERIC(10,2) NOT NULL DEFAULT 60,
    default_escalation_rate_walkin NUMERIC(10,2) NOT NULL DEFAULT 1,
    default_escalation_rate_appointment NUMERIC(10,2) NOT NULL DEFAULT 1,

    default_carry_over_waiting BOOLEAN NOT NULL DEFAULT FALSE,
    default_daily_reset_mode VARCHAR(20) NOT NULL DEFAULT 'close_all'
        CHECK (default_daily_reset_mode IN ('close_all','close_served_only')),
    default_daily_reset_time TIME NOT NULL DEFAULT '03:00',

    default_locale VARCHAR(10) NOT NULL DEFAULT 'fr',

    created_by_user_id INT,
    updated_by_user_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. dori_user (§3.14)
CREATE TABLE IF NOT EXISTS dori_user (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'human'
        CHECK (user_type IN ('human','kiosk')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    language_preference VARCHAR(10) NOT NULL DEFAULT 'fr',
    last_login TIMESTAMPTZ,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_username UNIQUE (username)
);

-- Foreign keys on dori_site to dori_user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_site_created_by'
    ) THEN
        ALTER TABLE dori_site ADD CONSTRAINT fk_site_created_by FOREIGN KEY (created_by_user_id) REFERENCES dori_user(user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_site_updated_by'
    ) THEN
        ALTER TABLE dori_site ADD CONSTRAINT fk_site_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES dori_user(user_id);
    END IF;
END $$;

-- 3. dori_role (§3.14)
CREATE TABLE IF NOT EXISTS dori_role (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    rank INT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_role_name UNIQUE (role_name)
);

-- 4. dori_permission (§3.14)
CREATE TABLE IF NOT EXISTS dori_permission (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_permission_name UNIQUE (permission_name)
);

-- 5. dori_role_permission (§3.14)
CREATE TABLE IF NOT EXISTS dori_role_permission (
    role_id INT NOT NULL REFERENCES dori_role(role_id),
    permission_id INT NOT NULL REFERENCES dori_permission(permission_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id INT REFERENCES dori_user(user_id),
    PRIMARY KEY (role_id, permission_id)
);

-- 6. dori_user_role (§3.14)
CREATE TABLE IF NOT EXISTS dori_user_role (
    user_id INT NOT NULL REFERENCES dori_user(user_id),
    role_id INT NOT NULL REFERENCES dori_role(role_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id INT REFERENCES dori_user(user_id),
    PRIMARY KEY (user_id, role_id)
);

-- 7. dori_user_site (§3.14)
CREATE TABLE IF NOT EXISTS dori_user_site (
    user_id INT NOT NULL REFERENCES dori_user(user_id),
    site_id INT NOT NULL REFERENCES dori_site(site_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id INT REFERENCES dori_user(user_id),
    PRIMARY KEY (user_id, site_id)
);

-- 8. dori_site_queue_thread (§3.3)
CREATE TABLE IF NOT EXISTS dori_site_queue_thread (
    queue_id SERIAL PRIMARY KEY,
    queue_code VARCHAR(10) NOT NULL,
    site_id INT NOT NULL REFERENCES dori_site(site_id),
    queue_name VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    average_wait_time INT NOT NULL DEFAULT 10,
    thread_count INT NOT NULL DEFAULT 1 CHECK (thread_count >= 1),

    appointments_enabled BOOLEAN,
    appointment_slot_duration INT,
    slot_capacity INT,
    working_hours_start TIME,
    working_hours_end TIME,
    break_start TIME,
    break_end TIME,
    late_tolerance_minutes INT,

    base_weight_walkin NUMERIC(10,2),
    base_weight_appointment NUMERIC(10,2),
    escalation_rate_walkin NUMERIC(10,2),
    escalation_rate_appointment NUMERIC(10,2),

    carry_over_waiting BOOLEAN,
    daily_reset_mode VARCHAR(20)
        CHECK (daily_reset_mode IN ('close_all','close_served_only')),
    daily_reset_time TIME,

    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_queue_code_site UNIQUE (queue_code, site_id)
);

-- 9. dori_user_queue (§3.14)
CREATE TABLE IF NOT EXISTS dori_user_queue (
    user_id INT NOT NULL REFERENCES dori_user(user_id),
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id INT REFERENCES dori_user(user_id),
    PRIMARY KEY (user_id, queue_id)
);

-- 10. dori_person (§3.4)
CREATE TABLE IF NOT EXISTS dori_person (
    person_id SERIAL PRIMARY KEY,
    site_id INT NOT NULL REFERENCES dori_site(site_id),
    first_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    birth_date DATE,
    language_preference VARCHAR(10) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_person_last_name_not_blank CHECK (BTRIM(last_name) <> ''),
    CONSTRAINT ck_person_phone_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{6,14}$')
);

-- 11. dori_person_note (§3.5)
CREATE TABLE IF NOT EXISTS dori_person_note (
    note_id SERIAL PRIMARY KEY,
    person_id INT NOT NULL REFERENCES dori_person(person_id),
    content TEXT NOT NULL,
    created_by_user_id INT NOT NULL REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. dori_service_tier (§3.6)
CREATE TABLE IF NOT EXISTS dori_service_tier (
    tier_id SERIAL PRIMARY KEY,
    tier_code VARCHAR(20) NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tier_code UNIQUE (tier_code)
);

-- 13. dori_queue_service_tier (§3.7)
CREATE TABLE IF NOT EXISTS dori_queue_service_tier (
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    tier_id INT NOT NULL REFERENCES dori_service_tier(tier_id),
    price NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'TND',
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, tier_id)
);

-- 14. dori_tier_notification_rule (§3.8)
CREATE TABLE IF NOT EXISTS dori_tier_notification_rule (
    rule_id SERIAL PRIMARY KEY,
    queue_id INT NOT NULL,
    tier_id INT NOT NULL,
    notification_type VARCHAR(20) NOT NULL
        CHECK (notification_type IN ('welcome','threshold', 'trakingLink')),
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('sms','email')),
    threshold_position INT,
    threshold_minutes INT,
    include_tracking_link BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rule_queue_tier FOREIGN KEY (queue_id, tier_id)
        REFERENCES dori_queue_service_tier(queue_id, tier_id),
    CONSTRAINT uk_rule_unique UNIQUE (queue_id, tier_id, notification_type, channel),

    CONSTRAINT ck_rule_threshold CHECK (
        notification_type <> 'threshold'
        OR threshold_position IS NOT NULL
        OR threshold_minutes IS NOT NULL
    ),

    CONSTRAINT ck_rule_tracking_link CHECK (
        include_tracking_link = FALSE
        OR (
            notification_type IN ('welcome', 'trakingLink')
            AND channel IN ('sms', 'email')
        )
    )
);

-- 15. dori_queue_session (§3.9)
CREATE TABLE IF NOT EXISTS dori_queue_session (
    session_id SERIAL PRIMARY KEY,
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    user_id INT NOT NULL REFERENCES dori_user(user_id),
    thread_number INT,
    mode VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (mode IN ('active','consultation_only')),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMPTZ,
    closure_reason VARCHAR(20)
        CHECK (closure_reason IN ('logout','taken_over','daily_reset','forced')),
    closed_by_user_id INT REFERENCES dori_user(user_id),
    CONSTRAINT ck_session_thread CHECK (
        (mode = 'active' AND thread_number IS NOT NULL)
        OR (mode = 'consultation_only' AND thread_number IS NULL)
    )
);

-- 16. dori_registration (§3.10)
CREATE TABLE IF NOT EXISTS dori_registration (
    registration_id SERIAL PRIMARY KEY,
    person_id INT NOT NULL REFERENCES dori_person(person_id),
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    tier_id INT NOT NULL,
    business_date DATE NOT NULL,
    ticket_number VARCHAR(14) NOT NULL,

    entry_type VARCHAR(20) NOT NULL DEFAULT 'walkin'
        CHECK (entry_type IN ('walkin','appointment')),
    scheduled_time TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    appointment_status VARCHAR(20) NOT NULL DEFAULT 'n/a'
        CHECK (appointment_status IN ('n/a','booked','checked_in','rescheduled','cancelled','expired')),
    priority_reference_time TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('booked','waiting','in_progress','served','no_show','expired','cancelled')),
    current_session_id INT REFERENCES dori_queue_session(session_id),
    called_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    carried_over_from_date DATE,

    registration_tracking_token UUID NOT NULL DEFAULT gen_random_uuid(),
    registration_tracking_token_valid_until TIMESTAMPTZ NOT NULL,

    payment_status VARCHAR(20) NOT NULL DEFAULT 'not_applicable'
        CHECK (payment_status IN ('not_applicable','pending','paid','refunded','failed')),
    payment_amount NUMERIC(10,3),
    payment_currency CHAR(3),
    payment_method VARCHAR(30)
        CHECK (payment_method IS NULL OR payment_method IN ('cash','card','kiosk_card','external')),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(128),

    language_preference VARCHAR(10),
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_registration_ticket UNIQUE (queue_id, business_date, ticket_number),
    CONSTRAINT fk_registration_tier FOREIGN KEY (queue_id, tier_id)
        REFERENCES dori_queue_service_tier(queue_id, tier_id),
    CONSTRAINT ck_registration_appointment CHECK (
        (entry_type = 'walkin' AND scheduled_time IS NULL AND appointment_status = 'n/a')
        OR (entry_type = 'appointment' AND scheduled_time IS NOT NULL
            AND appointment_status <> 'n/a')
    )
);

-- 17. dori_queue_counter (§3.11)
CREATE TABLE IF NOT EXISTS dori_queue_counter (
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    business_date DATE NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, business_date)
);

CREATE TABLE IF NOT EXISTS dori_queue_daily_reset (
    queue_id INT NOT NULL REFERENCES dori_site_queue_thread(queue_id),
    business_date DATE NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (queue_id, business_date)
);

-- 18. dori_notification (§3.12)
CREATE TABLE IF NOT EXISTS dori_notification (
    notification_id SERIAL PRIMARY KEY,
    registration_id INT NOT NULL REFERENCES dori_registration(registration_id),
    rule_id INT REFERENCES dori_tier_notification_rule(rule_id),
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('sms','email')),
    notification_type VARCHAR(20) NOT NULL
        CHECK (notification_type IN ('welcome','threshold', 'trakingLink')),
    locale VARCHAR(10) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    notification_content TEXT,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (notification_status IN ('pending','processing','sent','delivered','failed')),
    processing_started_at TIMESTAMPTZ,
    provider_message_id VARCHAR(128),
    provider VARCHAR(50),
    failure_reason TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dori_webhook_event (
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (provider, event_id)
);

ALTER TABLE dori_notification ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
ALTER TABLE dori_notification ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE dori_notification DROP CONSTRAINT IF EXISTS dori_notification_notification_status_check;
ALTER TABLE dori_notification ADD CONSTRAINT dori_notification_notification_status_check
    CHECK (notification_status IN ('pending','processing','sent','delivered','failed'));

-- 19. dori_translation (§3.13)
CREATE TABLE IF NOT EXISTS dori_translation (
    translation_id SERIAL PRIMARY KEY,
    translation_key VARCHAR(150) NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'ihm'
        CHECK (category IN ('ihm','sms','error')),
    locale VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    expected_params TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_translation_key_locale UNIQUE (translation_key, locale)
);

CREATE TABLE IF NOT EXISTS dori_translation_version (
    category VARCHAR(20) PRIMARY KEY
        CHECK (category IN ('ihm','sms','error')),
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. dori_user_session (§3.15)
CREATE TABLE IF NOT EXISTS dori_user_session (
    session_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES dori_user(user_id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(30)
        CHECK (revoked_reason IN ('global_logout','logout','rotation','account_disabled','account_deleted','password_changed','admin')),
    user_agent VARCHAR(255),
    ip_address INET,
    CONSTRAINT uk_session_refresh_token UNIQUE (refresh_token_hash)
);

ALTER TABLE dori_user_session DROP CONSTRAINT IF EXISTS dori_user_session_revoked_reason_check;
ALTER TABLE dori_user_session ADD CONSTRAINT dori_user_session_revoked_reason_check
    CHECK (revoked_reason IN ('global_logout','logout','rotation','account_disabled','account_deleted','password_changed','admin'));

-- Triggers for updated_at – idempotent (§3.17)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_site_updated_at ON dori_site;
  CREATE TRIGGER trg_site_updated_at BEFORE UPDATE ON dori_site FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_user_updated_at ON dori_user;
  CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON dori_user FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_role_updated_at ON dori_role;
  CREATE TRIGGER trg_role_updated_at BEFORE UPDATE ON dori_role FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_permission_updated_at ON dori_permission;
  CREATE TRIGGER trg_permission_updated_at BEFORE UPDATE ON dori_permission FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

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

  DROP TRIGGER IF EXISTS trg_tier_notification_rule_updated_at ON dori_tier_notification_rule;
  CREATE TRIGGER trg_tier_notification_rule_updated_at BEFORE UPDATE ON dori_tier_notification_rule FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_registration_updated_at ON dori_registration;
  CREATE TRIGGER trg_registration_updated_at BEFORE UPDATE ON dori_registration FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_notification_updated_at ON dori_notification;
  CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON dori_notification FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_translation_updated_at ON dori_translation;
  CREATE TRIGGER trg_translation_updated_at BEFORE UPDATE ON dori_translation FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();
END $$;

-- Indexes (§3.18)
-- Migration idempotente des installations antérieures à la territorialisation des personnes.
ALTER TABLE dori_person ADD COLUMN IF NOT EXISTS site_id INT REFERENCES dori_site(site_id);
DROP INDEX IF EXISTS uk_person_email_active;
DROP INDEX IF EXISTS uk_person_phone_active;

-- Le site d'une personne existante est déduit de ses inscriptions. Une fiche historiquement
-- partagée entre plusieurs sites est dupliquée, avec ses notes, puis chaque inscription est
-- réaffectée à la copie appartenant à son site.
UPDATE dori_person p
SET site_id = inferred.site_id
FROM (
    SELECT c.person_id, MIN(q.site_id) AS site_id
    FROM dori_registration c
    JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
    GROUP BY c.person_id
) inferred
WHERE p.person_id = inferred.person_id AND p.site_id IS NULL;

DO $$
DECLARE
    cross_site RECORD;
    cloned_person_id INT;
BEGIN
    FOR cross_site IN
        SELECT DISTINCT c.person_id, q.site_id
        FROM dori_registration c
        JOIN dori_site_queue_thread q ON q.queue_id = c.queue_id
        JOIN dori_person p ON p.person_id = c.person_id
        WHERE p.site_id IS DISTINCT FROM q.site_id
    LOOP
        INSERT INTO dori_person (
            site_id, first_name, last_name, email, phone_number, birth_date,
            language_preference, is_active, deleted_at, created_by_user_id,
            updated_by_user_id, created_at, updated_at
        )
        SELECT cross_site.site_id, first_name, last_name, email, phone_number,
               birth_date, language_preference, is_active, deleted_at,
               created_by_user_id, updated_by_user_id, created_at, updated_at
        FROM dori_person
        WHERE person_id = cross_site.person_id
        RETURNING person_id INTO cloned_person_id;

        INSERT INTO dori_person_note (
            person_id, content, created_by_user_id, updated_by_user_id,
            is_active, deleted_at, created_at, updated_at
        )
        SELECT cloned_person_id, content, created_by_user_id, updated_by_user_id,
               is_active, deleted_at, created_at, updated_at
        FROM dori_person_note
        WHERE person_id = cross_site.person_id;

        UPDATE dori_registration c
        SET person_id = cloned_person_id
        FROM dori_site_queue_thread q
        WHERE c.queue_id = q.queue_id
          AND c.person_id = cross_site.person_id
          AND q.site_id = cross_site.site_id;
    END LOOP;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM dori_person WHERE site_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot assign a site to orphan dori_person rows; migrate them explicitly before applying PERSON-001';
    END IF;
END $$;

ALTER TABLE dori_person ALTER COLUMN site_id SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM dori_person
        WHERE last_name IS NULL OR BTRIM(last_name) = '' OR phone_number IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot enforce SW-VAL-001: every existing dori_person must have a non-empty last_name and a phone_number';
    END IF;
END $$;

ALTER TABLE dori_person ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE dori_person ALTER COLUMN phone_number SET NOT NULL;
ALTER TABLE dori_person DROP CONSTRAINT IF EXISTS ck_person_last_name_not_blank;
ALTER TABLE dori_person ADD CONSTRAINT ck_person_last_name_not_blank CHECK (BTRIM(last_name) <> '');
ALTER TABLE dori_person DROP CONSTRAINT IF EXISTS ck_person_phone_e164;
ALTER TABLE dori_person ADD CONSTRAINT ck_person_phone_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{6,14}$');
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_site_email_active ON dori_person (site_id, LOWER(email)) WHERE email IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_site_phone_active ON dori_person (site_id, phone_number) WHERE phone_number IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_id_site ON dori_person (person_id, site_id);

CREATE OR REPLACE FUNCTION dori_check_registration_person_site() RETURNS trigger AS $$
DECLARE
    person_site_id INT;
    queue_site_id INT;
BEGIN
    SELECT site_id INTO person_site_id FROM dori_person WHERE person_id = NEW.person_id;
    SELECT site_id INTO queue_site_id FROM dori_site_queue_thread WHERE queue_id = NEW.queue_id;
    IF person_site_id IS DISTINCT FROM queue_site_id THEN
        RAISE EXCEPTION 'Person % belongs to site %, queue % belongs to site %',
            NEW.person_id, person_site_id, NEW.queue_id, queue_site_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_person_site ON dori_registration;
CREATE TRIGGER trg_registration_person_site
BEFORE INSERT OR UPDATE OF person_id, queue_id ON dori_registration
FOR EACH ROW EXECUTE FUNCTION dori_check_registration_person_site();
CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_thread_active ON dori_queue_session (queue_id, thread_number) WHERE disconnected_at IS NULL AND thread_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_user_active ON dori_queue_session (queue_id, user_id) WHERE disconnected_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_registration_person_open ON dori_registration (queue_id, person_id) WHERE status IN ('booked','waiting','in_progress') AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_once ON dori_notification (registration_id, notification_type, channel) WHERE notification_status <> 'failed';
DROP INDEX IF EXISTS idx_notification_provider_msg;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_provider_msg ON dori_notification (provider, provider_message_id) WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_email_active ON dori_user (LOWER(email)) WHERE email IS NOT NULL AND is_active;

CREATE INDEX IF NOT EXISTS idx_registration_queue_day_status ON dori_registration (queue_id, business_date, status) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_registration_priority_ref ON dori_registration (priority_reference_time);
CREATE INDEX IF NOT EXISTS idx_registration_scheduled_time ON dori_registration (scheduled_time) WHERE entry_type = 'appointment';
CREATE INDEX IF NOT EXISTS idx_registration_appt_status ON dori_registration (appointment_status, scheduled_time) WHERE entry_type = 'appointment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_registration_tracking_token ON dori_registration (registration_tracking_token);
CREATE INDEX IF NOT EXISTS idx_registration_person ON dori_registration (person_id);
CREATE INDEX IF NOT EXISTS idx_registration_session ON dori_registration (current_session_id);

CREATE INDEX IF NOT EXISTS idx_queue_session_active ON dori_queue_session (queue_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_queue_user ON dori_user_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_user ON dori_user_site (user_id);
CREATE INDEX IF NOT EXISTS idx_user_status ON dori_user (is_active, locked_until);

CREATE INDEX IF NOT EXISTS idx_queue_site ON dori_site_queue_thread (site_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_translation_lookup ON dori_translation (category, locale, translation_key) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_person_name ON dori_person (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_person_site_name ON dori_person (site_id, last_name, first_name) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_person_note_person ON dori_person_note (person_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_notification_registration ON dori_notification (registration_id);
CREATE INDEX IF NOT EXISTS idx_site_type ON dori_site (site_type);
