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
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(255),
    phone_number VARCHAR(20),
    birth_date DATE,
    language_preference VARCHAR(10) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id INT REFERENCES dori_user(user_id),
    updated_by_user_id INT REFERENCES dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_person_phone_e164 CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{6,14}$')
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

-- 16. dori_customer (§3.10)
CREATE TABLE IF NOT EXISTS dori_customer (
    customer_id SERIAL PRIMARY KEY,
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

    CONSTRAINT uk_customer_ticket UNIQUE (queue_id, business_date, ticket_number),
    CONSTRAINT fk_customer_tier FOREIGN KEY (queue_id, tier_id)
        REFERENCES dori_queue_service_tier(queue_id, tier_id),
    CONSTRAINT ck_customer_appointment CHECK (
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

-- 18. dori_notification (§3.12)
CREATE TABLE IF NOT EXISTS dori_notification (
    notification_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dori_customer(customer_id),
    rule_id INT REFERENCES dori_tier_notification_rule(rule_id),
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('sms','email')),
    notification_type VARCHAR(20) NOT NULL
        CHECK (notification_type IN ('welcome','threshold', 'trakingLink')),
    locale VARCHAR(10) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    notification_content TEXT,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (notification_status IN ('pending','sent','delivered','failed')),
    provider_message_id VARCHAR(128),
    failure_reason TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
        CHECK (revoked_reason IN ('global_logout','logout','rotation','account_disabled','password_changed','admin')),
    user_agent VARCHAR(255),
    ip_address INET,
    CONSTRAINT uk_session_refresh_token UNIQUE (refresh_token_hash)
);

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

  DROP TRIGGER IF EXISTS trg_customer_updated_at ON dori_customer;
  CREATE TRIGGER trg_customer_updated_at BEFORE UPDATE ON dori_customer FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_notification_updated_at ON dori_notification;
  CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON dori_notification FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_translation_updated_at ON dori_translation;
  CREATE TRIGGER trg_translation_updated_at BEFORE UPDATE ON dori_translation FOR EACH ROW EXECUTE FUNCTION dori_set_updated_at();
END $$;

-- Indexes (§3.18)
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_email_active ON dori_person (LOWER(email)) WHERE email IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_phone_active ON dori_person (phone_number) WHERE phone_number IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_thread_active ON dori_queue_session (queue_id, thread_number) WHERE disconnected_at IS NULL AND thread_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_user_active ON dori_queue_session (queue_id, user_id) WHERE disconnected_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_person_open ON dori_customer (queue_id, person_id) WHERE status IN ('booked','waiting','in_progress') AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_once ON dori_notification (customer_id, notification_type, channel) WHERE notification_status <> 'failed';
CREATE INDEX IF NOT EXISTS idx_notification_provider_msg ON dori_notification (provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_email_active ON dori_user (LOWER(email)) WHERE email IS NOT NULL AND is_active;

CREATE INDEX IF NOT EXISTS idx_customer_queue_day_status ON dori_customer (queue_id, business_date, status) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_customer_priority_ref ON dori_customer (priority_reference_time);
CREATE INDEX IF NOT EXISTS idx_customer_scheduled_time ON dori_customer (scheduled_time) WHERE entry_type = 'appointment';
CREATE INDEX IF NOT EXISTS idx_customer_appt_status ON dori_customer (appointment_status, scheduled_time) WHERE entry_type = 'appointment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_registration_tracking_token ON dori_customer (registration_tracking_token);
CREATE INDEX IF NOT EXISTS idx_customer_person ON dori_customer (person_id);
CREATE INDEX IF NOT EXISTS idx_customer_session ON dori_customer (current_session_id);

CREATE INDEX IF NOT EXISTS idx_queue_session_active ON dori_queue_session (queue_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_queue_user ON dori_user_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_user ON dori_user_site (user_id);
CREATE INDEX IF NOT EXISTS idx_user_status ON dori_user (is_active, locked_until);

CREATE INDEX IF NOT EXISTS idx_queue_site ON dori_site_queue_thread (site_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_translation_lookup ON dori_translation (category, locale, translation_key) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_person_name ON dori_person (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_person_note_person ON dori_person_note (person_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_notification_customer ON dori_notification (customer_id);
CREATE INDEX IF NOT EXISTS idx_site_type ON dori_site (site_type);
