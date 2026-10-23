-- =====================================================================
-- Canonical UUID baseline for the Dori application â€” Ã‰TAT FINAL
-- The public schema is intentionally never modified.
-- Toutes les migrations (001 Ã  018) sont consolidÃ©es directement dans
-- les CREATE TABLE : aucun ALTER TABLE ... ADD COLUMN ne subsiste.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS dorify;
SET search_path TO dorify, pg_catalog;

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dorify.dori_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. dorify.dori_user (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_user (
    user_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    full_name VARCHAR(150),
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'human'
        CHECK (user_type IN ('human','kiosk')),
    language_preference VARCHAR(10) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_username UNIQUE (username)
);

-- ---------------------------------------------------------------------
-- 2. dorify.dori_site (Â§3.2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_site (
    site_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL,
    site_location VARCHAR(255),
    site_logo_url TEXT,
    site_type VARCHAR(50) NOT NULL DEFAULT 'public'
        CHECK (site_type IN ('public','private')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Tunis',
    default_currency CHAR(3) NOT NULL DEFAULT 'TND',
    default_locale VARCHAR(10) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,

    -- Rendez-vous / horaires
    default_appointments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    default_appointment_slot_duration INT NOT NULL DEFAULT 15,
    default_slot_capacity INT NOT NULL DEFAULT 1,
    default_working_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
    default_working_hours_start TIME NOT NULL DEFAULT '08:00',
    default_working_hours_end TIME NOT NULL DEFAULT '17:00',
    default_break_start TIME DEFAULT '12:00',
    default_break_end TIME DEFAULT '14:00',
    default_late_tolerance_minutes INT NOT NULL DEFAULT 60,

    -- PrioritÃ©
    default_base_weight_walkin NUMERIC(10,2) NOT NULL DEFAULT 0,
    default_base_weight_appointment NUMERIC(10,2) NOT NULL DEFAULT 60,
    default_escalation_rate_walkin NUMERIC(10,2) NOT NULL DEFAULT 1,
    default_escalation_rate_appointment NUMERIC(10,2) NOT NULL DEFAULT 1,

    -- ClÃ´ture quotidienne
    default_carry_over_waiting BOOLEAN NOT NULL DEFAULT FALSE,
    default_daily_reset_mode VARCHAR(20) NOT NULL DEFAULT 'close_all'
        CHECK (default_daily_reset_mode IN ('close_all','carry_over_open')),
    default_daily_reset_time TIME NOT NULL DEFAULT '03:00',

    created_by_user_id UUID,
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_site_created_by FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT fk_site_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

-- ---------------------------------------------------------------------
-- 3. dorify.dori_role (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_role (
    role_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    rank INT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_role_name UNIQUE (role_name)
);

-- ---------------------------------------------------------------------
-- 4. dorify.dori_permission (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_permission (
    permission_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_permission_name UNIQUE (permission_name)
);

-- ---------------------------------------------------------------------
-- 5. dorify.dori_role_permission (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_role_permission (
    role_id UUID NOT NULL REFERENCES dorify.dori_role(role_id),
    permission_id UUID NOT NULL REFERENCES dorify.dori_permission(permission_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------
-- 6. dorify.dori_user_role (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_user_role (
    user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    role_id UUID NOT NULL REFERENCES dorify.dori_role(role_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    PRIMARY KEY (user_id, role_id)
);

-- ---------------------------------------------------------------------
-- 7. dorify.dori_user_site_assignment (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_user_site_assignment (
    user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    site_id UUID NOT NULL REFERENCES dorify.dori_site(site_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    PRIMARY KEY (user_id, site_id)
);

-- ---------------------------------------------------------------------
-- 8. dorify.dori_queue (Â§3.3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_queue (
    queue_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_code VARCHAR(10) NOT NULL,
    site_id UUID NOT NULL REFERENCES dorify.dori_site(site_id),
    queue_name VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    average_wait_time INT NOT NULL DEFAULT 10,
    thread_count INT NOT NULL DEFAULT 1 CHECK (thread_count >= 1),

    -- Surcharges des valeurs default_* du site (NULL = hÃ©ritage)
    currency CHAR(3),
    locale VARCHAR(10),

    appointments_enabled BOOLEAN,
    appointment_slot_duration INT,
    slot_capacity INT,
    working_days INT[] NULL,
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
        CHECK (daily_reset_mode IN ('close_all','carry_over_open')),
    daily_reset_time TIME,

    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_queue_code_site UNIQUE (queue_code, site_id)
);

-- ---------------------------------------------------------------------
-- 9. dorify.dori_user_queue_assignment (Â§3.14)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_user_queue_assignment (
    user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    PRIMARY KEY (user_id, queue_id)
);

-- ---------------------------------------------------------------------
-- 10. dorify.dori_person (Â§3.4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_person (
    person_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES dorify.dori_site(site_id),
    first_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    birth_date DATE,
    language_preference VARCHAR(10) NOT NULL DEFAULT 'fr',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_person_last_name_not_blank CHECK (BTRIM(last_name) <> ''),
    CONSTRAINT ck_person_phone_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{6,14}$')
);

-- ---------------------------------------------------------------------
-- 11. dorify.dori_person_note (Â§3.5)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_person_note (
    note_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES dorify.dori_person(person_id),
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 12. dorify.dori_service_tier (Â§3.6)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_service_tier (
    tier_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tier_code VARCHAR(20) NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_tier_code UNIQUE (tier_code)
);

-- ---------------------------------------------------------------------
-- 13. dorify.dori_queue_service_tier (Â§3.7)
-- currency NULL conserve l'hÃ©ritage dynamique queue -> site.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_queue_service_tier (
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    tier_id UUID NOT NULL REFERENCES dorify.dori_service_tier(tier_id),
    price NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency CHAR(3),
    display_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, tier_id)
);

-- ---------------------------------------------------------------------
-- 14. dorify.dori_queue_tier_notification_rule (Â§3.8)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_queue_tier_notification_rule (
    rule_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_id UUID NOT NULL,
    tier_id UUID NOT NULL,
    notification_type VARCHAR(20) NOT NULL,
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('sms','email')),
    threshold_position INT,
    threshold_minutes INT,
    include_tracking_link BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rule_queue_tier FOREIGN KEY (queue_id, tier_id)
        REFERENCES dorify.dori_queue_service_tier(queue_id, tier_id),
    CONSTRAINT uk_rule_unique UNIQUE (queue_id, tier_id, notification_type, channel),
    CONSTRAINT ck_rule_notification_type CHECK (
        notification_type IN ('welcome', 'threshold')
    ),
    CONSTRAINT ck_rule_threshold CHECK (
        (notification_type = 'welcome'
            AND num_nonnulls(threshold_position, threshold_minutes) = 0)
        OR
        (notification_type = 'threshold'
            AND num_nonnulls(threshold_position, threshold_minutes) = 1)
    )
);

-- ---------------------------------------------------------------------
-- 15. dorify.dori_operator_session (Â§3.9)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_operator_session (
    session_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    thread_number INT,
    counter_name VARCHAR(100),
    mode VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (mode IN ('active','consultation_only')),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMPTZ,
    closure_reason VARCHAR(20)
        CHECK (closure_reason IN ('logout','taken_over','daily_reset','forced')),
    closed_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    CONSTRAINT ck_session_thread CHECK (
        (mode = 'active' AND thread_number IS NOT NULL)
        OR (mode = 'consultation_only' AND thread_number IS NULL)
    ),
    CONSTRAINT ck_operator_session_counter_name CHECK (
        counter_name IS NULL
        OR LENGTH(BTRIM(counter_name)) BETWEEN 1 AND 100
    )
);

-- ---------------------------------------------------------------------
-- 16. dorify.dori_registration (Â§3.10)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_registration (
    registration_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES dorify.dori_person(person_id),
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    tier_id UUID NOT NULL,
    business_date DATE NOT NULL,
    ticket_number VARCHAR(14) NOT NULL,

    -- Type d'entrÃ©e / rendez-vous
    entry_type VARCHAR(20) NOT NULL DEFAULT 'walkin'
        CHECK (entry_type IN ('walkin','appointment')),
    scheduled_time TIMESTAMPTZ,
    appointment_status VARCHAR(20) NOT NULL DEFAULT 'n/a'
        CHECK (appointment_status IN ('n/a','booked','checked_in','rescheduled','cancelled','expired')),
    checked_in_at TIMESTAMPTZ,
    priority_reference_time TIMESTAMPTZ NOT NULL,

    -- Cycle de vie
    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('booked','waiting','in_progress','served','no_show','expired','cancelled')),
    called_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    carried_over_from_date DATE,
    served_by_session_id UUID REFERENCES dorify.dori_operator_session(session_id),
    served_by_user_id UUID REFERENCES dorify.dori_user(user_id),

    -- Suivi public
    registration_tracking_token UUID NOT NULL DEFAULT gen_random_uuid(),
    registration_tracking_token_valid_until TIMESTAMPTZ NOT NULL,

    -- Paiement
    payment_status VARCHAR(20) NOT NULL DEFAULT 'not_applicable'
        CHECK (payment_status IN ('not_applicable','pending','paid','refunded','failed')),
    payment_amount NUMERIC(10,3),
    payment_currency CHAR(3),
    payment_method VARCHAR(30)
        CHECK (payment_method IS NULL OR payment_method IN ('cash','card','kiosk_card','external')),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(128),

    language_preference VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_registration_ticket UNIQUE (queue_id, business_date, ticket_number),
    CONSTRAINT fk_registration_tier FOREIGN KEY (queue_id, tier_id)
        REFERENCES dorify.dori_queue_service_tier(queue_id, tier_id),
    CONSTRAINT ck_registration_appointment CHECK (
        (entry_type = 'walkin' AND scheduled_time IS NULL AND appointment_status = 'n/a')
        OR (entry_type = 'appointment' AND scheduled_time IS NOT NULL
            AND appointment_status <> 'n/a')
    ),
    CONSTRAINT ck_registration_served_by_pair CHECK (
        (served_by_session_id IS NULL AND served_by_user_id IS NULL)
        OR (served_by_session_id IS NOT NULL AND served_by_user_id IS NOT NULL)
    ),
    CONSTRAINT ck_registration_served_by_status CHECK (
        status NOT IN ('in_progress','served','no_show')
        OR (served_by_session_id IS NOT NULL AND served_by_user_id IS NOT NULL)
    ),
    CONSTRAINT chk_registration_walkin_checked_in
        CHECK (entry_type <> 'walkin' OR checked_in_at IS NOT NULL),
    CONSTRAINT chk_registration_called_after_checkin
        CHECK (called_at IS NULL OR (checked_in_at IS NOT NULL AND called_at >= checked_in_at)),
    CONSTRAINT chk_registration_checked_appointment_arrived
        CHECK (entry_type <> 'appointment' OR appointment_status <> 'checked_in' OR checked_in_at IS NOT NULL),
    CONSTRAINT chk_registration_served_after_called
        CHECK (served_at IS NULL OR (called_at IS NOT NULL AND served_at >= called_at))
);

-- L'utilisateur servant doit Ãªtre le propriÃ©taire de la session opÃ©rateur.
CREATE OR REPLACE FUNCTION dorify.dori_check_registration_served_by() RETURNS trigger AS $$
DECLARE session_user_id UUID;
BEGIN
    IF NEW.served_by_session_id IS NULL THEN RETURN NEW; END IF;
    SELECT user_id INTO session_user_id FROM dorify.dori_operator_session
    WHERE session_id = NEW.served_by_session_id;
    IF session_user_id IS NULL OR session_user_id <> NEW.served_by_user_id THEN
        RAISE EXCEPTION 'served_by_user_id % does not own session %',
            NEW.served_by_user_id, NEW.served_by_session_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_served_by ON dorify.dori_registration;
CREATE CONSTRAINT TRIGGER trg_registration_served_by
AFTER INSERT OR UPDATE OF served_by_session_id, served_by_user_id ON dorify.dori_registration
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dorify.dori_check_registration_served_by();

-- La personne et la file d'une inscription doivent appartenir au mÃªme site.
CREATE OR REPLACE FUNCTION dorify.dori_check_registration_person_site() RETURNS trigger AS $$
DECLARE
    person_site_id UUID;
    queue_site_id UUID;
BEGIN
    SELECT site_id INTO person_site_id FROM dorify.dori_person WHERE person_id = NEW.person_id;
    SELECT site_id INTO queue_site_id FROM dorify.dori_queue WHERE queue_id = NEW.queue_id;
    IF person_site_id IS DISTINCT FROM queue_site_id THEN
        RAISE EXCEPTION 'Person % belongs to site %, queue % belongs to site %',
            NEW.person_id, person_site_id, NEW.queue_id, queue_site_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_person_site ON dorify.dori_registration;
CREATE TRIGGER trg_registration_person_site
BEFORE INSERT OR UPDATE OF person_id, queue_id ON dorify.dori_registration
FOR EACH ROW EXECUTE FUNCTION dorify.dori_check_registration_person_site();

-- ---------------------------------------------------------------------
-- 17. dorify.dori_queue_daily_ticket_counter (Â§3.11) + exÃ©cution de clÃ´ture
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_queue_daily_ticket_counter (
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    business_date DATE NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, business_date)
);

CREATE TABLE IF NOT EXISTS dorify.dori_queue_daily_reset_execution (
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    business_date DATE NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (queue_id, business_date)
);

-- ---------------------------------------------------------------------
-- 18. dorify.dori_notification (Â§3.12) + webhook
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_notification (
    notification_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id UUID NOT NULL REFERENCES dorify.dori_registration(registration_id),
    rule_id UUID REFERENCES dorify.dori_queue_tier_notification_rule(rule_id),
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('sms','email')),
    notification_type VARCHAR(20) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    recipient VARCHAR(255),
    notification_content TEXT,
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processing_started_at TIMESTAMPTZ,
    provider VARCHAR(50),
    provider_message_id VARCHAR(128),
    failure_reason TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_notification_type
        CHECK (notification_type IN ('welcome', 'threshold')),
    CONSTRAINT ck_notification_status
        CHECK (notification_status IN ('pending','processing','sent','delivered','failed')),
    CONSTRAINT ck_notification_dispatchable CHECK (
        (notification_status = 'failed' AND failure_reason IS NOT NULL)
        OR
        (notification_status <> 'failed' AND recipient IS NOT NULL AND notification_content IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS dorify.dori_webhook_event (
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (provider, event_id)
);

-- ---------------------------------------------------------------------
-- 19. dorify.dori_translation (Â§3.13) + version par catÃ©gorie
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_translation (
    translation_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    translation_key VARCHAR(150) NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'ihm',
    locale VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    expected_params TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    updated_by_user_id UUID REFERENCES dorify.dori_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_translation_key_locale UNIQUE (translation_key, locale),
    CONSTRAINT ck_translation_category
        CHECK (category IN ('ihm','public_ihm','sms','email','error'))
);

CREATE TABLE IF NOT EXISTS dorify.dori_translation_category_version (
    category VARCHAR(20) PRIMARY KEY,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_translation_category_version_category
        CHECK (category IN ('ihm','public_ihm','sms','email','error'))
);

INSERT INTO dorify.dori_translation_category_version (category, version)
VALUES ('public_ihm', 1)
ON CONFLICT (category) DO NOTHING;

-- ---------------------------------------------------------------------
-- 20. dorify.dori_user_session (Â§3.15)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_user_session (
    session_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES dorify.dori_user(user_id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(30),
    user_agent VARCHAR(255),
    ip_address INET,
    CONSTRAINT uk_session_refresh_token UNIQUE (refresh_token_hash),
    CONSTRAINT ck_user_session_revoked_reason CHECK (
        revoked_reason IN (
            'global_logout','logout','force_logout','rotation',
            'account_disabled','account_deleted','password_changed','admin'
        )
    )
);

-- ---------------------------------------------------------------------
-- 21. dorify.dori_queue_estimation_stats
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_queue_estimation_stats (
    estimation_stats_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES dorify.dori_site(site_id),
    queue_id UUID NOT NULL REFERENCES dorify.dori_queue(queue_id),
    activity_date DATE NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    window_ended_at TIMESTAMPTZ NOT NULL,
    cycle_p50_minutes INT NULL CHECK (cycle_p50_minutes >= 0),
    cycle_p65_minutes INT NULL CHECK (cycle_p65_minutes >= 0),
    cycle_p90_minutes INT NULL CHECK (cycle_p90_minutes >= 0),
    wait_p50_minutes INT NULL CHECK (wait_p50_minutes >= 0),
    wait_p65_minutes INT NULL CHECK (wait_p65_minutes >= 0),
    wait_p90_minutes INT NULL CHECK (wait_p90_minutes >= 0),
    sample_size INT NOT NULL CHECK (sample_size >= 0),
    is_reliable BOOLEAN NOT NULL DEFAULT FALSE,
    calculated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_queue_estimation_stats_daily UNIQUE (site_id, queue_id, activity_date)
);

-- ---------------------------------------------------------------------
-- 22. dorify.dori_audit_event (journal append-only)
-- Production : les rÃ´les DB devraient aussi refuser UPDATE/DELETE/TRUNCATE.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dorify.dori_audit_event (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL REFERENCES dorify.dori_user(user_id),
    site_scope_id UUID REFERENCES dorify.dori_site(site_id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(128),
    secondary_target_id VARCHAR(128),
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('success', 'failure')),
    failure_type VARCHAR(100),
    correlation_id VARCHAR(128),
    request_method VARCHAR(10) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION dorify.dori_reject_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'dorify.dori_audit_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_event_append_only ON dorify.dori_audit_event;
CREATE TRIGGER trg_audit_event_append_only
BEFORE UPDATE OR DELETE ON dorify.dori_audit_event
FOR EACH ROW EXECUTE FUNCTION dorify.dori_reject_audit_event_mutation();

-- =====================================================================
-- Triggers updated_at (Â§3.17) â€” idempotents
-- =====================================================================
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_site_updated_at ON dorify.dori_site;
  CREATE TRIGGER trg_site_updated_at BEFORE UPDATE ON dorify.dori_site FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_user_updated_at ON dorify.dori_user;
  CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON dorify.dori_user FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_role_updated_at ON dorify.dori_role;
  CREATE TRIGGER trg_role_updated_at BEFORE UPDATE ON dorify.dori_role FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_permission_updated_at ON dorify.dori_permission;
  CREATE TRIGGER trg_permission_updated_at BEFORE UPDATE ON dorify.dori_permission FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_queue_updated_at ON dorify.dori_queue;
  CREATE TRIGGER trg_queue_updated_at BEFORE UPDATE ON dorify.dori_queue FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_person_updated_at ON dorify.dori_person;
  CREATE TRIGGER trg_person_updated_at BEFORE UPDATE ON dorify.dori_person FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_person_note_updated_at ON dorify.dori_person_note;
  CREATE TRIGGER trg_person_note_updated_at BEFORE UPDATE ON dorify.dori_person_note FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_service_tier_updated_at ON dorify.dori_service_tier;
  CREATE TRIGGER trg_service_tier_updated_at BEFORE UPDATE ON dorify.dori_service_tier FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_queue_service_tier_updated_at ON dorify.dori_queue_service_tier;
  CREATE TRIGGER trg_queue_service_tier_updated_at BEFORE UPDATE ON dorify.dori_queue_service_tier FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_tier_notification_rule_updated_at ON dorify.dori_queue_tier_notification_rule;
  CREATE TRIGGER trg_tier_notification_rule_updated_at BEFORE UPDATE ON dorify.dori_queue_tier_notification_rule FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_registration_updated_at ON dorify.dori_registration;
  CREATE TRIGGER trg_registration_updated_at BEFORE UPDATE ON dorify.dori_registration FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_notification_updated_at ON dorify.dori_notification;
  CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON dorify.dori_notification FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

  DROP TRIGGER IF EXISTS trg_translation_updated_at ON dorify.dori_translation;
  CREATE TRIGGER trg_translation_updated_at BEFORE UPDATE ON dorify.dori_translation FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();
END $$;

-- =====================================================================
-- Index (Â§3.18)
-- =====================================================================

-- dorify.dori_site
CREATE INDEX IF NOT EXISTS idx_site_type ON dorify.dori_site (site_type);

-- dorify.dori_user
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_email_active ON dorify.dori_user (LOWER(email)) WHERE email IS NOT NULL AND is_active;
CREATE INDEX IF NOT EXISTS idx_user_status ON dorify.dori_user (is_active, locked_until);

-- dorify.dori_queue
CREATE INDEX IF NOT EXISTS idx_queue_site ON dorify.dori_queue (site_id) WHERE is_active;

-- Affectations
CREATE INDEX IF NOT EXISTS idx_user_queue_assignment_user ON dorify.dori_user_queue_assignment (user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_assignment_user ON dorify.dori_user_site_assignment (user_id);

-- dorify.dori_person / dorify.dori_person_note
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_site_email_active ON dorify.dori_person (site_id, LOWER(email)) WHERE email IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_site_phone_active ON dorify.dori_person (site_id, phone_number) WHERE phone_number IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uk_person_id_site ON dorify.dori_person (person_id, site_id);
CREATE INDEX IF NOT EXISTS idx_person_name ON dorify.dori_person (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_person_site_name ON dorify.dori_person (site_id, last_name, first_name) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_person_note_person ON dorify.dori_person_note (person_id) WHERE is_active;

-- dorify.dori_queue_service_tier
CREATE UNIQUE INDEX IF NOT EXISTS uk_queue_tier_default ON dorify.dori_queue_service_tier (queue_id) WHERE is_default AND is_active;

-- dorify.dori_operator_session
CREATE UNIQUE INDEX IF NOT EXISTS uk_operator_session_queue_thread_active ON dorify.dori_operator_session (queue_id, thread_number) WHERE disconnected_at IS NULL AND thread_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_operator_session_queue_user_active ON dorify.dori_operator_session (queue_id, user_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operator_session_active ON dorify.dori_operator_session (queue_id) WHERE disconnected_at IS NULL;

-- dorify.dori_registration
CREATE UNIQUE INDEX IF NOT EXISTS uk_registration_person_open ON dorify.dori_registration (queue_id, person_id) WHERE status IN ('booked','waiting','in_progress') AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_registration_tracking_token ON dorify.dori_registration (registration_tracking_token);
CREATE INDEX IF NOT EXISTS idx_registration_queue_day_status ON dorify.dori_registration (queue_id, business_date, status) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_registration_priority_ref ON dorify.dori_registration (priority_reference_time);
CREATE INDEX IF NOT EXISTS idx_registration_scheduled_time ON dorify.dori_registration (scheduled_time) WHERE entry_type = 'appointment';
CREATE INDEX IF NOT EXISTS idx_registration_appt_status ON dorify.dori_registration (appointment_status, scheduled_time) WHERE entry_type = 'appointment';
CREATE INDEX IF NOT EXISTS idx_registration_person ON dorify.dori_registration (person_id);
CREATE INDEX IF NOT EXISTS idx_registration_served_by_session ON dorify.dori_registration (served_by_session_id);
CREATE INDEX IF NOT EXISTS idx_registration_served_by_user ON dorify.dori_registration (served_by_user_id);
-- Monitoring
CREATE INDEX IF NOT EXISTS idx_registration_queue_created_at ON dorify.dori_registration (queue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_registration_queue_served_at ON dorify.dori_registration (queue_id, served_at) WHERE served_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registration_queue_closed_at ON dorify.dori_registration (queue_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registration_monitoring_dimensions ON dorify.dori_registration (queue_id, served_by_user_id, tier_id, status, entry_type);
CREATE INDEX IF NOT EXISTS idx_registration_live_queue_status ON dorify.dori_registration (queue_id, status, priority_reference_time) WHERE is_active = TRUE AND status IN ('waiting', 'in_progress');

-- dorify.dori_notification
CREATE UNIQUE INDEX IF NOT EXISTS uk_notification_once ON dorify.dori_notification (registration_id, notification_type, channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_provider_msg ON dorify.dori_notification (provider, provider_message_id) WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_registration ON dorify.dori_notification (registration_id);

-- dorify.dori_translation
CREATE INDEX IF NOT EXISTS idx_translation_lookup ON dorify.dori_translation (category, locale, translation_key) WHERE is_active;

-- dorify.dori_queue_estimation_stats
CREATE INDEX IF NOT EXISTS idx_queue_estimation_stats_lookup ON dorify.dori_queue_estimation_stats (site_id, queue_id, activity_date, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_estimation_stats_reliable ON dorify.dori_queue_estimation_stats (site_id, queue_id, calculated_at DESC) WHERE is_reliable = TRUE;

-- dorify.dori_audit_event
CREATE INDEX IF NOT EXISTS idx_audit_event_actor_time ON dorify.dori_audit_event (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_target_time ON dorify.dori_audit_event (target_type, target_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_action_time ON dorify.dori_audit_event (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_site_time ON dorify.dori_audit_event (site_scope_id, occurred_at DESC);

-- =====================================================================
-- DonnÃ©es de rÃ©fÃ©rence (permissions) issues des migrations 006, 008, 017, 018
-- =====================================================================

-- queue_reset : manager, admin, root
INSERT INTO dorify.dori_permission (permission_name, description)
VALUES ('queue_reset', 'DÃ©clencher la clÃ´ture manuelle d''une queue')
ON CONFLICT (permission_name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dorify.dori_role r
CROSS JOIN dorify.dori_permission p
WHERE r.role_name IN ('manager', 'admin', 'root')
  AND p.permission_name = 'queue_reset'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- site_view : kiosk
INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dorify.dori_role r
CROSS JOIN dorify.dori_permission p
WHERE r.role_name = 'kiosk'
  AND p.permission_name = 'site_view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- audit_view : admin, root, manager
INSERT INTO dorify.dori_permission (permission_name, description)
VALUES ('audit_view', 'Consulter le journal d''audit dans son pÃ©rimÃ¨tre de sites')
ON CONFLICT (permission_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = TRUE;

INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dorify.dori_role r
CROSS JOIN dorify.dori_permission p
WHERE r.role_name IN ('admin', 'root', 'manager')
  AND p.permission_name = 'audit_view'
ON CONFLICT (role_id, permission_id) DO NOTHING;