-- Dorify consolidated baseline.
-- Final schema after migrations 001..025; no historical column additions or data backfills.
-- Reference data and demo data are installed separately.

-- Session settings

SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

-- Schemas and extensions

CREATE SCHEMA IF NOT EXISTS dorify;

CREATE SCHEMA IF NOT EXISTS dorify_agent;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;

-- Final tables, columns and constraints (dependency order)

CREATE TABLE dorify.dori_user (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    full_name character varying(150),
    email character varying(255),
    password_hash character varying(255) NOT NULL,
    user_type character varying(20) DEFAULT 'human'::character varying NOT NULL,
    language_preference character varying(10) DEFAULT 'fr'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    last_login timestamp with time zone,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_changed_at timestamp with time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_user_user_type_check CHECK ((user_type IN ('human', 'kiosk'))),
    CONSTRAINT dori_user_pkey PRIMARY KEY (user_id),
    CONSTRAINT uk_user_username UNIQUE (username),
    CONSTRAINT dori_user_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_user_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_site (
    site_id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_name character varying(255) NOT NULL,
    site_location character varying(255),
    site_logo_url text,
    site_type character varying(50) DEFAULT 'public'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'Africa/Tunis'::character varying NOT NULL,
    default_currency character(3) DEFAULT 'TND'::bpchar NOT NULL,
    default_locale character varying(10) DEFAULT 'fr'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    default_appointments_enabled boolean DEFAULT false NOT NULL,
    default_appointment_slot_duration integer DEFAULT 15 NOT NULL,
    default_slot_capacity integer DEFAULT 1 NOT NULL,
    default_working_days integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    default_working_hours_start time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    default_working_hours_end time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    default_break_start time without time zone DEFAULT '12:00:00'::time without time zone,
    default_break_end time without time zone DEFAULT '14:00:00'::time without time zone,
    default_late_tolerance_minutes integer DEFAULT 60 NOT NULL,
    default_base_weight_walkin numeric(10,2) DEFAULT 0 NOT NULL,
    default_base_weight_appointment numeric(10,2) DEFAULT 60 NOT NULL,
    default_escalation_rate_walkin numeric(10,2) DEFAULT 1 NOT NULL,
    default_escalation_rate_appointment numeric(10,2) DEFAULT 1 NOT NULL,
    default_carry_over_waiting boolean DEFAULT false NOT NULL,
    default_daily_reset_mode character varying(20) DEFAULT 'close_all'::character varying NOT NULL,
    default_daily_reset_time time without time zone DEFAULT '03:00:00'::time without time zone NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_site_default_daily_reset_mode_check CHECK ((default_daily_reset_mode IN ('close_all', 'carry_over_open'))),
    CONSTRAINT dori_site_site_type_check CHECK ((site_type IN ('public', 'private'))),
    CONSTRAINT dori_site_pkey PRIMARY KEY (site_id),
    CONSTRAINT fk_site_created_by FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT fk_site_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_audit_event (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    site_scope_id uuid,
    action character varying(100) NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id character varying(128),
    secondary_target_id character varying(128),
    outcome character varying(16) NOT NULL,
    failure_type character varying(100),
    correlation_id character varying(128),
    request_method character varying(10) NOT NULL,
    request_path character varying(255) NOT NULL,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_audit_event_outcome_check CHECK ((outcome IN ('success', 'failure'))),
    CONSTRAINT dori_audit_event_pkey PRIMARY KEY (event_id),
    CONSTRAINT dori_audit_event_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_audit_event_site_scope_id_fkey FOREIGN KEY (site_scope_id) REFERENCES dorify.dori_site(site_id)
);

CREATE TABLE dorify.dori_edge_installation (
    installation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_name character varying(200) NOT NULL,
    token_hash character(64) NOT NULL,
    credential_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_seen_at timestamp with time zone,
    last_heartbeat jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deployment_type character varying(20) DEFAULT 'intra'::character varying NOT NULL,
    deployment_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT dori_edge_installation_credential_status_check CHECK ((credential_status IN ('active', 'revoked'))),
    CONSTRAINT dori_edge_installation_deployment_status_check CHECK ((deployment_status IN ('active', 'revoked'))),
    CONSTRAINT dori_edge_installation_deployment_type_check CHECK (((deployment_type)::text = 'intra'::text)),
    CONSTRAINT dori_edge_installation_pkey PRIMARY KEY (installation_id),
    CONSTRAINT dori_edge_installation_token_hash_key UNIQUE (token_hash)
);

CREATE TABLE dorify.dori_edge_command (
    command_id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id uuid NOT NULL,
    command_type character varying(40) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    command_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    result jsonb,
    error_message character varying(1000),
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    acknowledged_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT dori_edge_command_command_status_check CHECK ((command_status IN ('pending', 'acknowledged', 'succeeded', 'failed', 'timedOut'))),
    CONSTRAINT dori_edge_command_command_type_check CHECK ((command_type IN ('RUN_HEALTH_CHECK', 'SYNC_NOW'))),
    CONSTRAINT dori_edge_command_pkey PRIMARY KEY (command_id),
    CONSTRAINT dori_edge_command_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_edge_command_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES dorify.dori_edge_installation(installation_id) ON DELETE CASCADE
);

CREATE TABLE dorify.dori_person (
    person_id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    first_name character varying(50),
    last_name character varying(50) NOT NULL,
    email character varying(255),
    phone_number character varying(20) NOT NULL,
    birth_date date,
    language_preference character varying(10) DEFAULT 'fr'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_person_last_name_not_blank CHECK ((btrim((last_name)::text) <> ''::text)),
    CONSTRAINT ck_person_phone_e164 CHECK (((phone_number)::text ~ '^\+[1-9][0-9]{6,14}$'::text)),
    CONSTRAINT dori_person_pkey PRIMARY KEY (person_id),
    CONSTRAINT dori_person_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_person_site_id_fkey FOREIGN KEY (site_id) REFERENCES dorify.dori_site(site_id),
    CONSTRAINT dori_person_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_queue (
    queue_id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_code character varying(10) NOT NULL,
    site_id uuid NOT NULL,
    queue_name character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    average_wait_time integer DEFAULT 10 NOT NULL,
    thread_count integer DEFAULT 1 NOT NULL,
    currency character(3),
    locale character varying(10),
    appointments_enabled boolean,
    appointment_slot_duration integer,
    slot_capacity integer,
    working_days integer[],
    working_hours_start time without time zone,
    working_hours_end time without time zone,
    break_start time without time zone,
    break_end time without time zone,
    late_tolerance_minutes integer,
    base_weight_walkin numeric(10,2),
    base_weight_appointment numeric(10,2),
    escalation_rate_walkin numeric(10,2),
    escalation_rate_appointment numeric(10,2),
    carry_over_waiting boolean,
    daily_reset_mode character varying(20),
    daily_reset_time time without time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_queue_daily_reset_mode_check CHECK ((daily_reset_mode IN ('close_all', 'carry_over_open'))),
    CONSTRAINT dori_queue_thread_count_check CHECK ((thread_count >= 1)),
    CONSTRAINT dori_queue_pkey PRIMARY KEY (queue_id),
    CONSTRAINT uk_queue_code_site UNIQUE (queue_code, site_id),
    CONSTRAINT dori_queue_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_queue_site_id_fkey FOREIGN KEY (site_id) REFERENCES dorify.dori_site(site_id),
    CONSTRAINT dori_queue_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_operator_session (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_id uuid NOT NULL,
    user_id uuid NOT NULL,
    thread_number integer,
    counter_name character varying(100),
    mode character varying(20) DEFAULT 'active'::character varying NOT NULL,
    connected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    disconnected_at timestamp with time zone,
    closure_reason character varying(20),
    closed_by_user_id uuid,
    CONSTRAINT ck_operator_session_counter_name CHECK (((counter_name IS NULL) OR ((length(btrim((counter_name)::text)) >= 1) AND (length(btrim((counter_name)::text)) <= 100)))),
    CONSTRAINT ck_session_thread CHECK (((((mode)::text = 'active'::text) AND (thread_number IS NOT NULL)) OR (((mode)::text = 'consultation_only'::text) AND (thread_number IS NULL)))),
    CONSTRAINT dori_operator_session_closure_reason_check CHECK ((closure_reason IN ('logout', 'taken_over', 'daily_reset', 'forced'))),
    CONSTRAINT dori_operator_session_mode_check CHECK ((mode IN ('active', 'consultation_only'))),
    CONSTRAINT dori_operator_session_pkey PRIMARY KEY (session_id),
    CONSTRAINT dori_operator_session_closed_by_user_id_fkey FOREIGN KEY (closed_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_operator_session_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id),
    CONSTRAINT dori_operator_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_service_tier (
    tier_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier_code character varying(20) NOT NULL,
    tier_name character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_service_tier_pkey PRIMARY KEY (tier_id),
    CONSTRAINT uk_tier_code UNIQUE (tier_code),
    CONSTRAINT dori_service_tier_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_service_tier_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_queue_service_tier (
    queue_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    price numeric(10,3) DEFAULT 0 NOT NULL,
    currency character(3),
    display_order integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_queue_service_tier_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT dori_queue_service_tier_pkey PRIMARY KEY (queue_id, tier_id),
    CONSTRAINT dori_queue_service_tier_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_queue_service_tier_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id),
    CONSTRAINT dori_queue_service_tier_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES dorify.dori_service_tier(tier_id),
    CONSTRAINT dori_queue_service_tier_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_registration (
    registration_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    queue_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    business_date date NOT NULL,
    ticket_number character varying(14) NOT NULL,
    entry_type character varying(20) DEFAULT 'walkin'::character varying NOT NULL,
    scheduled_time timestamp with time zone,
    appointment_status character varying(20) DEFAULT 'n/a'::character varying NOT NULL,
    checked_in_at timestamp with time zone,
    priority_reference_time timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    called_at timestamp with time zone,
    served_at timestamp with time zone,
    closed_at timestamp with time zone,
    carried_over_from_date date,
    served_by_session_id uuid,
    served_by_user_id uuid,
    registration_tracking_token uuid DEFAULT gen_random_uuid() NOT NULL,
    registration_tracking_token_valid_until timestamp with time zone NOT NULL,
    payment_status character varying(20) DEFAULT 'not_applicable'::character varying NOT NULL,
    payment_amount numeric(10,3),
    payment_currency character(3),
    payment_method character varying(30),
    paid_at timestamp with time zone,
    payment_reference character varying(128),
    language_preference character varying(10),
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_recalled_at timestamp with time zone,
    recall_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_registration_called_after_checkin CHECK (((called_at IS NULL) OR ((checked_in_at IS NOT NULL) AND (called_at >= checked_in_at)))),
    CONSTRAINT chk_registration_checked_appointment_arrived CHECK ((((entry_type)::text <> 'appointment'::text) OR ((appointment_status)::text <> 'checked_in'::text) OR (checked_in_at IS NOT NULL))),
    CONSTRAINT chk_registration_served_after_called CHECK (((served_at IS NULL) OR ((called_at IS NOT NULL) AND (served_at >= called_at)))),
    CONSTRAINT chk_registration_walkin_checked_in CHECK ((((entry_type)::text <> 'walkin'::text) OR (checked_in_at IS NOT NULL))),
    CONSTRAINT ck_registration_appointment CHECK (((((entry_type)::text = 'walkin'::text) AND (scheduled_time IS NULL) AND ((appointment_status)::text = 'n/a'::text)) OR (((entry_type)::text = 'appointment'::text) AND (scheduled_time IS NOT NULL) AND ((appointment_status)::text <> 'n/a'::text)))),
    CONSTRAINT ck_registration_recall_count_non_negative CHECK ((recall_count >= 0)),
    CONSTRAINT ck_registration_served_by_pair CHECK ((((served_by_session_id IS NULL) AND (served_by_user_id IS NULL)) OR ((served_by_session_id IS NOT NULL) AND (served_by_user_id IS NOT NULL)))),
    CONSTRAINT ck_registration_served_by_status CHECK (((status NOT IN ('in_progress', 'served', 'no_show')) OR ((served_by_session_id IS NOT NULL) AND (served_by_user_id IS NOT NULL)))),
    CONSTRAINT dori_registration_appointment_status_check CHECK ((appointment_status IN ('n/a', 'booked', 'checked_in', 'rescheduled', 'cancelled', 'expired'))),
    CONSTRAINT dori_registration_entry_type_check CHECK ((entry_type IN ('walkin', 'appointment'))),
    CONSTRAINT dori_registration_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method IN ('cash', 'card', 'kiosk_card', 'external')))),
    CONSTRAINT dori_registration_payment_status_check CHECK ((payment_status IN ('not_applicable', 'pending', 'paid', 'refunded', 'failed'))),
    CONSTRAINT dori_registration_status_check CHECK ((status IN ('booked', 'waiting', 'in_progress', 'served', 'no_show', 'expired', 'cancelled'))),
    CONSTRAINT dori_registration_pkey PRIMARY KEY (registration_id),
    CONSTRAINT uk_registration_ticket UNIQUE (queue_id, business_date, ticket_number),
    CONSTRAINT dori_registration_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_registration_person_id_fkey FOREIGN KEY (person_id) REFERENCES dorify.dori_person(person_id),
    CONSTRAINT dori_registration_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id),
    CONSTRAINT dori_registration_served_by_session_id_fkey FOREIGN KEY (served_by_session_id) REFERENCES dorify.dori_operator_session(session_id),
    CONSTRAINT dori_registration_served_by_user_id_fkey FOREIGN KEY (served_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_registration_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT fk_registration_tier FOREIGN KEY (queue_id, tier_id) REFERENCES dorify.dori_queue_service_tier(queue_id, tier_id)
);

CREATE TABLE dorify.dori_queue_tier_notification_rule (
    rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    notification_type character varying(20) NOT NULL,
    channel character varying(20) NOT NULL,
    threshold_position integer,
    threshold_minutes integer,
    include_tracking_link boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_rule_notification_type CHECK ((notification_type IN ('welcome', 'threshold'))),
    CONSTRAINT ck_rule_threshold CHECK (((((notification_type)::text = 'welcome'::text) AND (num_nonnulls(threshold_position, threshold_minutes) = 0)) OR (((notification_type)::text = 'threshold'::text) AND (num_nonnulls(threshold_position, threshold_minutes) = 1)))),
    CONSTRAINT dori_queue_tier_notification_rule_channel_check CHECK ((channel IN ('sms', 'email'))),
    CONSTRAINT dori_queue_tier_notification_rule_pkey PRIMARY KEY (rule_id),
    CONSTRAINT uk_rule_unique UNIQUE (queue_id, tier_id, notification_type, channel),
    CONSTRAINT dori_queue_tier_notification_rule_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_queue_tier_notification_rule_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT fk_rule_queue_tier FOREIGN KEY (queue_id, tier_id) REFERENCES dorify.dori_queue_service_tier(queue_id, tier_id)
);

CREATE TABLE dorify.dori_notification (
    notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    registration_id uuid,
    rule_id uuid,
    channel character varying(20) NOT NULL,
    notification_type character varying(20) NOT NULL,
    locale character varying(10) NOT NULL,
    recipient character varying(255),
    notification_content text,
    notification_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    processing_started_at timestamp with time zone,
    provider character varying(50),
    provider_message_id character varying(128),
    failure_reason text,
    attempt_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_installation_id uuid,
    source_registration_id uuid,
    dispatch_route character varying(20) DEFAULT 'direct'::character varying NOT NULL,
    CONSTRAINT ck_notification_dispatch_route CHECK ((dispatch_route IN ('direct', 'cloud_relay', 'disabled_offline'))),
    CONSTRAINT ck_notification_dispatchable CHECK (((((notification_status)::text = 'failed'::text) AND (failure_reason IS NOT NULL)) OR (((notification_status)::text <> 'failed'::text) AND (recipient IS NOT NULL) AND (notification_content IS NOT NULL)))),
    CONSTRAINT ck_notification_origin CHECK ((((registration_id IS NOT NULL) AND (source_installation_id IS NULL)) OR ((registration_id IS NULL) AND (source_installation_id IS NOT NULL) AND (source_registration_id IS NOT NULL)))),
    CONSTRAINT ck_notification_status CHECK ((notification_status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped_offline'))),
    CONSTRAINT ck_notification_type CHECK ((notification_type IN ('welcome', 'threshold'))),
    CONSTRAINT dori_notification_channel_check CHECK ((channel IN ('sms', 'email'))),
    CONSTRAINT dori_notification_pkey PRIMARY KEY (notification_id),
    CONSTRAINT dori_notification_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES dorify.dori_registration(registration_id),
    CONSTRAINT dori_notification_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES dorify.dori_queue_tier_notification_rule(rule_id),
    CONSTRAINT dori_notification_source_installation_id_fkey FOREIGN KEY (source_installation_id) REFERENCES dorify.dori_edge_installation(installation_id)
);

CREATE TABLE dorify.dori_permission (
    permission_id uuid DEFAULT gen_random_uuid() NOT NULL,
    permission_name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_permission_pkey PRIMARY KEY (permission_id),
    CONSTRAINT uk_permission_name UNIQUE (permission_name)
);

CREATE TABLE dorify.dori_person_note (
    note_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid NOT NULL,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_person_note_pkey PRIMARY KEY (note_id),
    CONSTRAINT dori_person_note_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_person_note_person_id_fkey FOREIGN KEY (person_id) REFERENCES dorify.dori_person(person_id),
    CONSTRAINT dori_person_note_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_public_tracking_state (
    tracking_token_hash character(64) NOT NULL,
    registration_id uuid,
    source_installation_id uuid,
    source_registration_id uuid,
    sequence bigint DEFAULT 1 NOT NULL,
    cloud_synced_sequence bigint DEFAULT 0 NOT NULL,
    ticket_number character varying(14),
    registration_status character varying(20) NOT NULL,
    "position" integer,
    estimated_wait_minutes integer,
    counter_name character varying(100),
    queue_public_name character varying(200),
    observed_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_public_tracking_origin CHECK ((((registration_id IS NOT NULL) AND (source_installation_id IS NULL)) OR ((registration_id IS NULL) AND (source_installation_id IS NOT NULL) AND (source_registration_id IS NOT NULL)))),
    CONSTRAINT dori_public_tracking_state_cloud_synced_sequence_check CHECK ((cloud_synced_sequence >= 0)),
    CONSTRAINT dori_public_tracking_state_sequence_check CHECK ((sequence > 0)),
    CONSTRAINT dori_public_tracking_state_pkey PRIMARY KEY (tracking_token_hash),
    CONSTRAINT dori_public_tracking_state_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES dorify.dori_registration(registration_id) ON DELETE CASCADE,
    CONSTRAINT dori_public_tracking_state_source_installation_id_fkey FOREIGN KEY (source_installation_id) REFERENCES dorify.dori_edge_installation(installation_id)
);

CREATE TABLE dorify.dori_queue_daily_reset_execution (
    queue_id uuid NOT NULL,
    business_date date NOT NULL,
    executed_at timestamp with time zone NOT NULL,
    CONSTRAINT dori_queue_daily_reset_execution_pkey PRIMARY KEY (queue_id, business_date),
    CONSTRAINT dori_queue_daily_reset_execution_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id)
);

CREATE TABLE dorify.dori_queue_daily_ticket_counter (
    queue_id uuid NOT NULL,
    business_date date NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_queue_daily_ticket_counter_pkey PRIMARY KEY (queue_id, business_date),
    CONSTRAINT dori_queue_daily_ticket_counter_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id)
);

CREATE TABLE dorify.dori_queue_estimation_revision (
    queue_id uuid NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    calculated_revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT dori_queue_estimation_revision_pkey PRIMARY KEY (queue_id),
    CONSTRAINT dori_queue_estimation_revision_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE
);

CREATE TABLE dorify.dori_queue_estimation_stats (
    estimation_stats_id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    queue_id uuid NOT NULL,
    activity_date date NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    window_ended_at timestamp with time zone NOT NULL,
    cycle_p50_minutes integer,
    cycle_p65_minutes integer,
    cycle_p90_minutes integer,
    wait_p50_minutes integer,
    wait_p65_minutes integer,
    wait_p90_minutes integer,
    sample_size integer NOT NULL,
    is_reliable boolean DEFAULT false NOT NULL,
    calculated_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    input_revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT dori_queue_estimation_stats_cycle_p50_minutes_check CHECK ((cycle_p50_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_cycle_p65_minutes_check CHECK ((cycle_p65_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_cycle_p90_minutes_check CHECK ((cycle_p90_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_sample_size_check CHECK ((sample_size >= 0)),
    CONSTRAINT dori_queue_estimation_stats_wait_p50_minutes_check CHECK ((wait_p50_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_wait_p65_minutes_check CHECK ((wait_p65_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_wait_p90_minutes_check CHECK ((wait_p90_minutes >= 0)),
    CONSTRAINT dori_queue_estimation_stats_pkey PRIMARY KEY (estimation_stats_id),
    CONSTRAINT uq_queue_estimation_stats_daily UNIQUE (site_id, queue_id, activity_date),
    CONSTRAINT dori_queue_estimation_stats_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id),
    CONSTRAINT dori_queue_estimation_stats_site_id_fkey FOREIGN KEY (site_id) REFERENCES dorify.dori_site(site_id)
);

CREATE TABLE dorify.dori_realtime_outbox (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error_at timestamp with time zone,
    processing_started_at timestamp with time zone,
    next_attempt_at timestamp with time zone,
    CONSTRAINT dori_realtime_outbox_event_type_check CHECK ((event_type IN ('queue_display_changed', 'queue_position_changed'))),
    CONSTRAINT dori_realtime_outbox_pkey PRIMARY KEY (event_id),
    CONSTRAINT dori_realtime_outbox_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id)
);

CREATE TABLE dorify.dori_realtime_topic_state (
    queue_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    event_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_realtime_topic_state_event_type_check CHECK ((event_type IN ('queue_display_changed', 'queue_position_changed'))),
    CONSTRAINT dori_realtime_topic_state_pkey PRIMARY KEY (queue_id, event_type),
    CONSTRAINT dori_realtime_topic_state_event_id_fkey FOREIGN KEY (event_id) REFERENCES dorify.dori_realtime_outbox(event_id),
    CONSTRAINT dori_realtime_topic_state_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id)
);

CREATE TABLE dorify.dori_role (
    role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(50) NOT NULL,
    rank integer NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT dori_role_pkey PRIMARY KEY (role_id),
    CONSTRAINT uk_role_name UNIQUE (role_name)
);

CREATE TABLE dorify.dori_role_permission (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by_user_id uuid,
    CONSTRAINT dori_role_permission_pkey PRIMARY KEY (role_id, permission_id),
    CONSTRAINT dori_role_permission_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_role_permission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES dorify.dori_permission(permission_id),
    CONSTRAINT dori_role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES dorify.dori_role(role_id)
);

CREATE TABLE dorify.dori_translation (
    translation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    translation_key character varying(150) NOT NULL,
    category character varying(20) DEFAULT 'ihm'::character varying NOT NULL,
    locale character varying(10) NOT NULL,
    content text NOT NULL,
    expected_params text[],
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_translation_category CHECK ((category IN ('ihm', 'public_ihm', 'sms', 'email', 'error'))),
    CONSTRAINT dori_translation_pkey PRIMARY KEY (translation_id),
    CONSTRAINT uk_translation_key_locale UNIQUE (translation_key, locale),
    CONSTRAINT dori_translation_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_translation_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_translation_category_version (
    category character varying(20) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_translation_category_version_category CHECK ((category IN ('ihm', 'public_ihm', 'sms', 'email', 'error'))),
    CONSTRAINT dori_translation_category_version_pkey PRIMARY KEY (category)
);

CREATE TABLE dorify.dori_user_queue_assignment (
    user_id uuid NOT NULL,
    queue_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by_user_id uuid,
    CONSTRAINT dori_user_queue_assignment_pkey PRIMARY KEY (user_id, queue_id),
    CONSTRAINT dori_user_queue_assignment_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_user_queue_assignment_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id),
    CONSTRAINT dori_user_queue_assignment_user_id_fkey FOREIGN KEY (user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_user_role (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by_user_id uuid,
    CONSTRAINT dori_user_role_pkey PRIMARY KEY (user_id, role_id),
    CONSTRAINT dori_user_role_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES dorify.dori_role(role_id),
    CONSTRAINT dori_user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_user_session (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash character varying(255) NOT NULL,
    issued_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_reason character varying(30),
    user_agent character varying(255),
    ip_address inet,
    CONSTRAINT ck_user_session_revoked_reason CHECK ((revoked_reason IN ('global_logout', 'logout', 'force_logout', 'rotation', 'account_disabled', 'account_deleted', 'password_changed', 'admin'))),
    CONSTRAINT dori_user_session_pkey PRIMARY KEY (session_id),
    CONSTRAINT uk_session_refresh_token UNIQUE (refresh_token_hash),
    CONSTRAINT dori_user_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_user_site_assignment (
    user_id uuid NOT NULL,
    site_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by_user_id uuid,
    CONSTRAINT dori_user_site_assignment_pkey PRIMARY KEY (user_id, site_id),
    CONSTRAINT dori_user_site_assignment_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES dorify.dori_user(user_id),
    CONSTRAINT dori_user_site_assignment_site_id_fkey FOREIGN KEY (site_id) REFERENCES dorify.dori_site(site_id),
    CONSTRAINT dori_user_site_assignment_user_id_fkey FOREIGN KEY (user_id) REFERENCES dorify.dori_user(user_id)
);

CREATE TABLE dorify.dori_webhook_event (
    provider character varying(50) NOT NULL,
    event_id character varying(255) NOT NULL,
    received_at timestamp with time zone NOT NULL,
    CONSTRAINT dori_webhook_event_pkey PRIMARY KEY (provider, event_id)
);

CREATE TABLE dorify_agent.agent_state (
    state_key text NOT NULL,
    state_value text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT agent_state_pkey PRIMARY KEY (state_key)
);

CREATE TABLE dorify_agent.command_inbox (
    command_id uuid NOT NULL,
    command_type text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL,
    result jsonb,
    received_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    lease_until timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '00:02:00'::interval),
    CONSTRAINT command_inbox_pkey PRIMARY KEY (command_id)
);

CREATE TABLE dorify_agent.tracking_checkpoint (
    queue_id uuid NOT NULL,
    full_refreshed_at timestamp with time zone NOT NULL,
    CONSTRAINT tracking_checkpoint_pkey PRIMARY KEY (queue_id),
    CONSTRAINT tracking_checkpoint_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE
);

CREATE TABLE dorify_agent.tracking_dirty_queue (
    queue_id uuid NOT NULL,
    full_refresh boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT tracking_dirty_queue_pkey PRIMARY KEY (queue_id),
    CONSTRAINT tracking_dirty_queue_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES dorify.dori_queue(queue_id) ON DELETE CASCADE
);

CREATE TABLE dorify_agent.tracking_dirty_registration (
    registration_id uuid NOT NULL,
    CONSTRAINT tracking_dirty_registration_pkey PRIMARY KEY (registration_id),
    CONSTRAINT tracking_dirty_registration_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES dorify.dori_registration(registration_id) ON DELETE CASCADE
);

-- Final functions (one definition per signature)

CREATE FUNCTION dorify.dori_check_registration_person_site() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION dorify.dori_check_registration_served_by() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION dorify.dori_reject_audit_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'dorify.dori_audit_event is append-only';
END;
$$;

CREATE FUNCTION dorify.dori_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dorify.mark_estimation_inputs_dirty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP!='DELETE' THEN
    INSERT INTO dorify.dori_queue_estimation_revision(queue_id)
    SELECT DISTINCT queue_id FROM new_rows WHERE called_at IS NOT NULL
    ON CONFLICT(queue_id) DO UPDATE SET revision=dorify.dori_queue_estimation_revision.revision+1;
  END IF;
  IF TG_OP!='INSERT' THEN
    INSERT INTO dorify.dori_queue_estimation_revision(queue_id)
    SELECT DISTINCT r.queue_id FROM old_rows r
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id WHERE r.called_at IS NOT NULL
    ON CONFLICT(queue_id) DO UPDATE SET revision=dorify.dori_queue_estimation_revision.revision+1;
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION dorify.queue_estimate_minutes(people_ahead integer, cycle_minutes numeric, active_threads integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE WHEN people_ahead IS NULL OR active_threads<=0 OR active_threads IS NULL OR cycle_minutes IS NULL THEN NULL
    WHEN people_ahead<=0 OR cycle_minutes<=0 THEN 0
    ELSE GREATEST(1,ROUND((people_ahead*cycle_minutes/active_threads)/5)*5)::int END
$$;

CREATE FUNCTION dorify.queue_estimation_needs_refresh(p_queue uuid, p_date date, p_now timestamp with time zone) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM dorify.dori_queue_estimation_stats stats
    JOIN dorify.dori_queue_estimation_revision rev USING(queue_id)
    WHERE stats.queue_id=p_queue AND stats.activity_date=p_date
      AND stats.input_revision>=rev.revision AND stats.calculated_at>=p_now-INTERVAL '15 minutes'
  )
$$;

CREATE FUNCTION dorify.queue_operational_candidates(queue_ids uuid[], observed timestamp with time zone) RETURNS TABLE(registration_id uuid, queue_id uuid, business_date date, called_early boolean, call_sort_time timestamp with time zone, score numeric)
    LANGUAGE sql STABLE
    AS $$
    SELECT r.registration_id,r.queue_id,r.business_date,
      (r.entry_type='appointment' AND r.scheduled_time>observed) AS called_early,
      CASE WHEN r.entry_type='appointment' AND r.scheduled_time>observed THEN r.scheduled_time ELSE r.priority_reference_time END AS call_sort_time,
      CASE WHEN r.entry_type='appointment' AND r.scheduled_time>observed THEN 0::numeric ELSE
        ROUND((CASE WHEN r.entry_type='appointment'
          THEN COALESCE(q.base_weight_appointment,s.default_base_weight_appointment,60)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60 * COALESCE(q.escalation_rate_appointment,s.default_escalation_rate_appointment,1)
          ELSE COALESCE(q.base_weight_walkin,s.default_base_weight_walkin,0)
            + EXTRACT(EPOCH FROM (observed-r.priority_reference_time))/60 * COALESCE(q.escalation_rate_walkin,s.default_escalation_rate_walkin,1)
          END)::numeric,2) END AS score
    FROM dorify.dori_registration r
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    JOIN dorify.dori_site s ON s.site_id=q.site_id
    WHERE r.queue_id=ANY(queue_ids) AND r.status='waiting' AND r.is_active
      AND (r.entry_type='walkin' OR r.appointment_status='checked_in')
$$;

CREATE FUNCTION dorify.queue_operational_positions(queue_ids uuid[], observed timestamp with time zone) RETURNS TABLE(registration_id uuid, queue_id uuid, business_date date, "position" integer)
    LANGUAGE sql STABLE
    AS $$
  SELECT registration_id,queue_id,business_date,"position" FROM dorify.queue_operational_ranking(queue_ids,observed)
$$;

CREATE FUNCTION dorify.queue_operational_ranking(queue_ids uuid[], observed timestamp with time zone) RETURNS TABLE(registration_id uuid, queue_id uuid, business_date date, "position" integer, score numeric, called_early boolean, call_sort_time timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  SELECT registration_id,queue_id,business_date,
    ROW_NUMBER() OVER(PARTITION BY queue_id,business_date ORDER BY called_early,score DESC,call_sort_time,registration_id)::int,
    score,called_early,call_sort_time FROM dorify.queue_operational_candidates(queue_ids,observed)
$$;

CREATE FUNCTION dorify.queue_refresh_estimation_stats(p_site uuid, p_queue uuid, p_date date, p_now timestamp with time zone, p_force boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE event_name TEXT; new_event UUID;
BEGIN
  IF NOT p_force AND NOT dorify.queue_estimation_needs_refresh(p_queue,p_date,p_now) THEN RETURN FALSE; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('queue-estimation:'||p_queue::text,0)) THEN RETURN FALSE; END IF;
  INSERT INTO dorify.dori_queue_estimation_revision(queue_id) VALUES(p_queue) ON CONFLICT DO NOTHING;
  PERFORM revision FROM dorify.dori_queue_estimation_revision WHERE queue_id=p_queue FOR UPDATE;
  WITH ordered_calls AS (
           SELECT r.called_at,
             LEAD(r.called_at) OVER (
               PARTITION BY r.served_by_session_id, r.business_date
               ORDER BY r.called_at, r.registration_id
             ) AS next_called_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date
             AND r.called_at IS NOT NULL AND r.served_by_session_id IS NOT NULL
             AND r.is_active = TRUE
         ), cycles AS (
           SELECT EXTRACT(EPOCH FROM (next_called_at - called_at)) / 60.0 AS minutes
           FROM ordered_calls
           WHERE next_called_at IS NOT NULL AND next_called_at >= called_at
             AND next_called_at - called_at <= INTERVAL '8 hours'
         ), waits AS (
           SELECT EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)) / 60.0 AS minutes
           FROM dorify.dori_registration r
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date
             AND r.called_at IS NOT NULL AND r.checked_in_at IS NOT NULL
             AND r.called_at >= r.checked_in_at AND r.is_active = TRUE
         ), cycle_stats AS (
           SELECT COUNT(*)::int AS sample_size,
             ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY minutes))::int AS p50,
             ROUND(PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY minutes))::int AS p65,
             ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY minutes))::int AS p90
           FROM cycles
         ), wait_stats AS (
           SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY minutes))::int AS p50,
             ROUND(PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY minutes))::int AS p65,
             ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY minutes))::int AS p90
           FROM waits
         ), bounds AS (
           SELECT COALESCE(MIN(COALESCE(r.checked_in_at, r.called_at)), p_now) AS started_at
           FROM dorify.dori_registration r
           WHERE r.queue_id = p_queue AND r.business_date = p_date::date AND r.is_active = TRUE
         )
         INSERT INTO dorify.dori_queue_estimation_stats (
           site_id, queue_id, activity_date, window_started_at, window_ended_at,
           cycle_p50_minutes, cycle_p65_minutes, cycle_p90_minutes,
           wait_p50_minutes, wait_p65_minutes, wait_p90_minutes,
           sample_size, is_reliable, input_revision, calculated_at, created_at, updated_at
         )
         SELECT p_site, p_queue, p_date::date, b.started_at, p_now,
           c.p50, c.p65, c.p90, w.p50, w.p65, w.p90,
           c.sample_size, c.sample_size >= 30,
           (SELECT revision FROM dorify.dori_queue_estimation_revision WHERE queue_id=p_queue), p_now, p_now, p_now
         FROM cycle_stats c CROSS JOIN wait_stats w CROSS JOIN bounds b
         ON CONFLICT (site_id, queue_id, activity_date) DO UPDATE SET
           window_started_at = EXCLUDED.window_started_at,
           window_ended_at = EXCLUDED.window_ended_at,
           cycle_p50_minutes = EXCLUDED.cycle_p50_minutes,
           cycle_p65_minutes = EXCLUDED.cycle_p65_minutes,
           cycle_p90_minutes = EXCLUDED.cycle_p90_minutes,
           wait_p50_minutes = EXCLUDED.wait_p50_minutes,
           wait_p65_minutes = EXCLUDED.wait_p65_minutes,
           wait_p90_minutes = EXCLUDED.wait_p90_minutes,
           sample_size = EXCLUDED.sample_size,
           is_reliable = EXCLUDED.is_reliable,
           input_revision = EXCLUDED.input_revision,
           calculated_at = EXCLUDED.calculated_at,
           updated_at = EXCLUDED.updated_at;
  UPDATE dorify.dori_queue_estimation_revision SET calculated_revision=revision WHERE queue_id=p_queue;
  FOREACH event_name IN ARRAY ARRAY['queue_position_changed','queue_display_changed'] LOOP
    INSERT INTO dorify.dori_realtime_outbox(queue_id,event_type,payload,created_at,published_at)
      VALUES(p_queue,event_name,jsonb_build_object('queueId',p_queue,'reason','estimation_updated','timestamp',p_now),p_now,p_now)
      RETURNING event_id INTO new_event;
    INSERT INTO dorify.dori_realtime_topic_state(queue_id,event_type,version,event_id,updated_at)
      VALUES(p_queue,event_name,1,new_event,p_now)
      ON CONFLICT(queue_id,event_type) DO UPDATE SET version=dorify.dori_realtime_topic_state.version+1,event_id=EXCLUDED.event_id,updated_at=EXCLUDED.updated_at;
  END LOOP;
  RETURN TRUE;
END $$;

CREATE FUNCTION dorify.queue_ticket_estimates(queue_ids uuid[], observed timestamp with time zone, refresh_stats boolean DEFAULT true, registration_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(registration_id uuid, queue_id uuid, business_date date, "position" integer, estimated_wait_minutes integer, method text, sample_size integer, is_reliable boolean, stats_calculated_at timestamp with time zone, calculated_at timestamp with time zone)
    LANGUAGE sql
    AS $$
  WITH dates AS (SELECT DISTINCT r.queue_id,r.business_date FROM dorify.dori_registration r WHERE r.queue_id=ANY(queue_ids) AND r.is_active AND r.status IN ('waiting','in_progress') AND (registration_ids IS NULL OR r.registration_id=ANY(registration_ids))),
  contexts AS MATERIALIZED (SELECT context.* FROM dates CROSS JOIN LATERAL dorify.queue_wait_context(ARRAY[dates.queue_id],observed,dates.business_date,refresh_stats) context),
  ranked AS MATERIALIZED (SELECT * FROM dorify.queue_operational_positions(queue_ids,observed))
  SELECT r.registration_id,r.queue_id,r.business_date,
    CASE WHEN r.status='in_progress' THEN 0 ELSE ranking."position" END,
    CASE WHEN r.status='in_progress' THEN 0 ELSE dorify.queue_estimate_minutes(ranking."position"-1,c.cycle_minutes,c.active_threads) END,
    CASE WHEN ranking."position" IS NULL AND r.status='waiting' THEN 'unavailable' ELSE c.method END,c.sample_size,COALESCE(ranking."position" IS NOT NULL AND c.is_reliable,FALSE),c.stats_calculated_at,observed
  FROM dorify.dori_registration r
  JOIN contexts c ON c.queue_id=r.queue_id AND c.business_date=r.business_date
  LEFT JOIN ranked ranking ON ranking.registration_id=r.registration_id
  WHERE r.queue_id=ANY(queue_ids) AND r.is_active AND r.status IN ('waiting','in_progress') AND (registration_ids IS NULL OR r.registration_id=ANY(registration_ids))
$$;

CREATE FUNCTION dorify.queue_wait_context(queue_ids uuid[], observed timestamp with time zone, requested_date date DEFAULT NULL::date, refresh_stats boolean DEFAULT true) RETURNS TABLE(site_id uuid, queue_id uuid, business_date date, waiting_count integer, active_threads integer, estimated_wait_minutes integer, cycle_minutes numeric, method text, sample_size integer, is_reliable boolean, stats_calculated_at timestamp with time zone, calculated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE context RECORD;
BEGIN
  IF refresh_stats THEN
    FOR context IN SELECT q.site_id,q.queue_id,COALESCE(requested_date,(observed AT TIME ZONE s.timezone)::date) AS activity_date
      FROM dorify.dori_queue q JOIN dorify.dori_site s USING(site_id) WHERE q.queue_id=ANY(queue_ids) ORDER BY q.queue_id
    LOOP
      PERFORM dorify.queue_refresh_estimation_stats(context.site_id,context.queue_id,context.activity_date,observed);
    END LOOP;
  END IF;
  RETURN QUERY WITH ranked AS MATERIALIZED (SELECT * FROM dorify.queue_operational_candidates(queue_ids,observed)),
    contexts AS (
      SELECT q.site_id,q.queue_id,COALESCE(requested_date,(observed AT TIME ZONE s.timezone)::date) AS activity_date,q.average_wait_time
      FROM dorify.dori_queue q JOIN dorify.dori_site s USING(site_id) WHERE q.queue_id=ANY(queue_ids)
    ), inputs AS (
      SELECT c.*, (SELECT COUNT(*)::int FROM ranked r WHERE r.queue_id=c.queue_id AND r.business_date=c.activity_date) AS waiting,
        (SELECT COUNT(*)::int FROM dorify.dori_operator_session os WHERE os.queue_id=c.queue_id AND os.disconnected_at IS NULL AND os.mode='active') AS threads,
        stat.activity_date AS stat_date,stat.cycle_p50_minutes,stat.sample_size,stat.is_reliable,stat.calculated_at
      FROM contexts c LEFT JOIN LATERAL (
        SELECT e.activity_date,e.cycle_p50_minutes,e.sample_size,e.is_reliable,e.calculated_at
        FROM dorify.dori_queue_estimation_stats e WHERE e.queue_id=c.queue_id AND e.site_id=c.site_id
          AND e.cycle_p50_minutes IS NOT NULL AND e.activity_date<=c.activity_date
        ORDER BY e.activity_date DESC,e.calculated_at DESC LIMIT 1
      ) stat ON TRUE
    )
    SELECT i.site_id,i.queue_id,i.activity_date,i.waiting,i.threads,
      dorify.queue_estimate_minutes(i.waiting,COALESCE(i.cycle_p50_minutes,i.average_wait_time),i.threads),
      COALESCE(i.cycle_p50_minutes,i.average_wait_time)::numeric,
      CASE WHEN i.threads=0 THEN 'unavailable' WHEN i.stat_date=i.activity_date THEN 'queue_daily_p50' WHEN i.stat_date IS NOT NULL THEN 'last_calculated' ELSE 'theoretical_queue' END,
      i.sample_size,COALESCE(i.threads>0 AND i.stat_date=i.activity_date AND i.is_reliable AND NOT dorify.queue_estimation_needs_refresh(i.queue_id,i.activity_date,observed),FALSE),i.calculated_at,observed FROM inputs i;
END $$;

CREATE FUNCTION dorify_agent.mark_queue_tracking_dirty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE target UUID;
BEGIN
  IF TG_OP='DELETE' THEN target=OLD.queue_id; ELSE target=NEW.queue_id; END IF;
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id,full_refresh)
    SELECT target, TG_TABLE_NAME='dori_queue'
    WHERE EXISTS(SELECT 1 FROM dorify.dori_queue WHERE queue_id=target)
    ON CONFLICT(queue_id) DO UPDATE SET
      full_refresh=dorify_agent.tracking_dirty_queue.full_refresh OR EXCLUDED.full_refresh,
      updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;

CREATE FUNCTION dorify_agent.mark_registration_tracking_dirty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Transition tables keep a bulk registration update to one invalidation per file.
  INSERT INTO dorify_agent.tracking_dirty_registration(registration_id)
    SELECT registration_id FROM new_rows ORDER BY registration_id ON CONFLICT DO NOTHING;
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id)
    SELECT DISTINCT queue_id FROM new_rows ORDER BY queue_id
    ON CONFLICT(queue_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;

CREATE FUNCTION dorify_agent.mark_site_tracking_dirty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO dorify_agent.tracking_dirty_queue(queue_id,full_refresh)
    SELECT q.queue_id,TRUE FROM dorify.dori_queue q WHERE q.site_id=NEW.site_id ORDER BY q.queue_id
    ON CONFLICT(queue_id) DO UPDATE SET full_refresh=TRUE,updated_at=CURRENT_TIMESTAMP;
  RETURN NULL;
END $$;

CREATE FUNCTION dorify_agent.notify_tracking_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_notify('dorify_tracking_dirty', 'changed');
  RETURN NULL;
END;
$$;

CREATE FUNCTION dorify_agent.refresh_tracking(observed timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE targets UUID[]; dirty UUID[]; changed UUID[]; full_targets UUID[]; affected INT; refresh_context RECORD;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('dorify:tracking-projection')) THEN RETURN 0; END IF;
  -- Refresh statistics before taking dirty-row locks (same lock order as API reads).
  FOR refresh_context IN SELECT DISTINCT q.site_id,r.queue_id,r.business_date FROM dorify.dori_registration r JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    WHERE r.is_active AND r.status IN ('waiting','in_progress') AND r.registration_tracking_token_valid_until>observed
    ORDER BY r.queue_id,r.business_date,q.site_id LOOP
    PERFORM dorify.queue_refresh_estimation_stats(refresh_context.site_id,refresh_context.queue_id,refresh_context.business_date,observed);
  END LOOP;
  -- Lock claimed work until commit. Concurrent transactions enqueue after deletion,
  -- so even a long transaction with an old updated_at cannot be lost.
  SELECT array_agg(registration_id) INTO changed FROM (
    SELECT registration_id FROM dorify_agent.tracking_dirty_registration ORDER BY registration_id FOR UPDATE
  ) claimed;
  SELECT array_agg(queue_id) INTO dirty FROM (
    SELECT queue_id FROM dorify_agent.tracking_dirty_queue ORDER BY queue_id FOR UPDATE
  ) claimed;
  SELECT array_agg(q.queue_id) INTO full_targets
  FROM dorify.dori_queue q LEFT JOIN dorify_agent.tracking_checkpoint c USING(queue_id)
  LEFT JOIN dorify_agent.tracking_dirty_queue d USING(queue_id)
  WHERE c.queue_id IS NULL OR c.full_refreshed_at<observed-INTERVAL '15 minutes' OR d.full_refresh;
  SELECT array_agg(DISTINCT queue_id) INTO targets FROM (
    SELECT unnest(dirty) AS queue_id UNION SELECT unnest(full_targets)
    UNION SELECT queue_id FROM dorify.dori_registration
      WHERE is_active AND status IN ('waiting','in_progress')
        AND registration_tracking_token_valid_until>observed
  ) queues;
  IF targets IS NULL THEN RETURN 0; END IF;
  WITH candidates AS MATERIALIZED (
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.queue_id=ANY(targets) AND r.is_active AND r.status IN ('waiting','in_progress')
        AND r.registration_tracking_token_valid_until>observed
    UNION
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.registration_id=ANY(changed)
    UNION
    SELECT r.registration_id FROM dorify.dori_registration r
      WHERE r.queue_id=ANY(full_targets) AND r.registration_tracking_token_valid_until>observed
  ), estimates AS MATERIALIZED (
    SELECT * FROM dorify.queue_ticket_estimates(targets,observed,FALSE,ARRAY(SELECT candidate.registration_id FROM candidates candidate))
  ), incoming AS (
    SELECT encode(sha256(convert_to(r.registration_tracking_token::text,'UTF8')),'hex') AS token_hash,
      r.registration_id,r.ticket_number,r.status,q.queue_name,os.counter_name,
      CASE WHEN r.is_active THEN r.registration_tracking_token_valid_until
        ELSE LEAST(r.registration_tracking_token_valid_until,observed) END AS expires_at,
      e."position",e.estimated_wait_minutes AS estimated_wait
    FROM candidates candidate
    JOIN dorify.dori_registration r ON r.registration_id=candidate.registration_id
    JOIN dorify.dori_queue q ON q.queue_id=r.queue_id
    LEFT JOIN estimates e ON e.registration_id=r.registration_id
    LEFT JOIN dorify.dori_operator_session os ON os.session_id=r.served_by_session_id
  )
  INSERT INTO dorify.dori_public_tracking_state
    (tracking_token_hash,registration_id,sequence,cloud_synced_sequence,ticket_number,
     registration_status,"position",estimated_wait_minutes,counter_name,queue_public_name,
     observed_at,expires_at,updated_at)
  SELECT token_hash,registration_id,1,0,ticket_number,status,"position",estimated_wait,
    counter_name,queue_name,observed,expires_at,observed FROM incoming
  ON CONFLICT(tracking_token_hash) DO UPDATE SET
    sequence=dorify.dori_public_tracking_state.sequence+1,ticket_number=EXCLUDED.ticket_number,
    registration_status=EXCLUDED.registration_status,"position"=EXCLUDED."position",
    estimated_wait_minutes=EXCLUDED.estimated_wait_minutes,counter_name=EXCLUDED.counter_name,
    queue_public_name=EXCLUDED.queue_public_name,observed_at=EXCLUDED.observed_at,
    expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at
  WHERE (dorify.dori_public_tracking_state.ticket_number,dorify.dori_public_tracking_state.registration_status,
    dorify.dori_public_tracking_state."position",dorify.dori_public_tracking_state.estimated_wait_minutes,
    dorify.dori_public_tracking_state.counter_name,dorify.dori_public_tracking_state.queue_public_name,
    dorify.dori_public_tracking_state.expires_at)
  IS DISTINCT FROM (EXCLUDED.ticket_number,EXCLUDED.registration_status,EXCLUDED."position",
    EXCLUDED.estimated_wait_minutes,EXCLUDED.counter_name,EXCLUDED.queue_public_name,EXCLUDED.expires_at);
  GET DIAGNOSTICS affected=ROW_COUNT;
  DELETE FROM dorify_agent.tracking_dirty_registration WHERE registration_id=ANY(changed);
  DELETE FROM dorify_agent.tracking_dirty_queue WHERE queue_id=ANY(dirty);
  INSERT INTO dorify_agent.tracking_checkpoint(queue_id,full_refreshed_at)
    SELECT unnest(full_targets),observed
    ON CONFLICT(queue_id) DO UPDATE SET full_refreshed_at=EXCLUDED.full_refreshed_at;
  RETURN affected;
END $$;

-- Indexes

CREATE INDEX idx_audit_event_action_time ON dorify.dori_audit_event USING btree (action, occurred_at DESC);

CREATE INDEX idx_audit_event_actor_time ON dorify.dori_audit_event USING btree (actor_user_id, occurred_at DESC);

CREATE INDEX idx_audit_event_site_time ON dorify.dori_audit_event USING btree (site_scope_id, occurred_at DESC);

CREATE INDEX idx_audit_event_target_time ON dorify.dori_audit_event USING btree (target_type, target_id, occurred_at DESC);

CREATE INDEX idx_edge_command_installation_created ON dorify.dori_edge_command USING btree (installation_id, created_at, command_id);

CREATE INDEX idx_edge_command_pending_expiry ON dorify.dori_edge_command USING btree (expires_at, installation_id) WHERE (command_status IN ('pending', 'acknowledged'));

CREATE INDEX idx_edge_installation_deployment_status ON dorify.dori_edge_installation USING btree (deployment_status, installation_name);

CREATE INDEX idx_edge_installation_last_seen ON dorify.dori_edge_installation USING btree (last_seen_at DESC);

CREATE INDEX idx_notification_cloud_relay_pending ON dorify.dori_notification USING btree (created_at, notification_id) WHERE (((dispatch_route)::text = 'cloud_relay'::text) AND ((notification_status)::text = 'pending'::text));

CREATE INDEX idx_notification_created_registration ON dorify.dori_notification USING btree (created_at DESC, registration_id);

CREATE INDEX idx_notification_direct_pending ON dorify.dori_notification USING btree (created_at, notification_id) WHERE (((dispatch_route)::text = 'direct'::text) AND (notification_status IN ('pending', 'processing')));

CREATE UNIQUE INDEX idx_notification_provider_msg ON dorify.dori_notification USING btree (provider, provider_message_id) WHERE ((provider IS NOT NULL) AND (provider_message_id IS NOT NULL));

CREATE INDEX idx_notification_registration ON dorify.dori_notification USING btree (registration_id);

CREATE INDEX idx_operator_session_active ON dorify.dori_operator_session USING btree (queue_id) WHERE (disconnected_at IS NULL);

CREATE INDEX idx_person_name ON dorify.dori_person USING btree (last_name, first_name);

CREATE INDEX idx_person_note_person ON dorify.dori_person_note USING btree (person_id) WHERE is_active;

CREATE INDEX idx_person_site_name ON dorify.dori_person USING btree (site_id, last_name, first_name) WHERE is_active;

CREATE INDEX idx_public_tracking_expiry ON dorify.dori_public_tracking_state USING btree (expires_at);

CREATE INDEX idx_public_tracking_unsynced ON dorify.dori_public_tracking_state USING btree (updated_at, tracking_token_hash) WHERE (sequence > cloud_synced_sequence);

CREATE INDEX idx_public_tracking_unsynced_live ON dorify.dori_public_tracking_state USING btree ((
CASE
    WHEN (registration_status IN ('waiting', 'in_progress')) THEN 0
    ELSE 1
END), updated_at, tracking_token_hash) WHERE (sequence > cloud_synced_sequence);

CREATE INDEX idx_queue_estimation_stats_lookup ON dorify.dori_queue_estimation_stats USING btree (site_id, queue_id, activity_date, calculated_at DESC);

CREATE INDEX idx_queue_estimation_stats_reliable ON dorify.dori_queue_estimation_stats USING btree (site_id, queue_id, calculated_at DESC) WHERE (is_reliable = true);

CREATE INDEX idx_queue_site ON dorify.dori_queue USING btree (site_id) WHERE is_active;

CREATE INDEX idx_realtime_outbox_pending ON dorify.dori_realtime_outbox USING btree (COALESCE(next_attempt_at, created_at), created_at, event_id) WHERE (published_at IS NULL);

CREATE INDEX idx_realtime_outbox_published_cleanup ON dorify.dori_realtime_outbox USING btree (published_at) WHERE (published_at IS NOT NULL);

CREATE INDEX idx_realtime_outbox_replay ON dorify.dori_realtime_outbox USING btree (queue_id, event_type, created_at, event_id);

CREATE INDEX idx_registration_appt_status ON dorify.dori_registration USING btree (appointment_status, scheduled_time) WHERE ((entry_type)::text = 'appointment'::text);

CREATE INDEX idx_registration_live_queue_status ON dorify.dori_registration USING btree (queue_id, status, priority_reference_time) WHERE ((is_active = true) AND (status IN ('waiting', 'in_progress')));

CREATE INDEX idx_registration_monitoring_dimensions ON dorify.dori_registration USING btree (queue_id, served_by_user_id, tier_id, status, entry_type);

CREATE INDEX idx_registration_person ON dorify.dori_registration USING btree (person_id);

CREATE INDEX idx_registration_priority_ref ON dorify.dori_registration USING btree (priority_reference_time);

CREATE INDEX idx_registration_queue_business_created_active ON dorify.dori_registration USING btree (queue_id, business_date, created_at DESC) WHERE (is_active = true);

CREATE INDEX idx_registration_queue_closed_at ON dorify.dori_registration USING btree (queue_id, closed_at) WHERE (closed_at IS NOT NULL);

CREATE INDEX idx_registration_queue_created_at ON dorify.dori_registration USING btree (queue_id, created_at);

CREATE INDEX idx_registration_queue_day_status ON dorify.dori_registration USING btree (queue_id, business_date, status) WHERE is_active;

CREATE INDEX idx_registration_queue_served_at ON dorify.dori_registration USING btree (queue_id, served_at) WHERE (served_at IS NOT NULL);

CREATE UNIQUE INDEX idx_registration_registration_tracking_token ON dorify.dori_registration USING btree (registration_tracking_token);

CREATE INDEX idx_registration_scheduled_time ON dorify.dori_registration USING btree (scheduled_time) WHERE ((entry_type)::text = 'appointment'::text);

CREATE INDEX idx_registration_served_by_session ON dorify.dori_registration USING btree (served_by_session_id);

CREATE INDEX idx_registration_served_by_user ON dorify.dori_registration USING btree (served_by_user_id);

CREATE INDEX idx_site_type ON dorify.dori_site USING btree (site_type);

CREATE INDEX idx_translation_lookup ON dorify.dori_translation USING btree (category, locale, translation_key) WHERE is_active;

CREATE INDEX idx_user_queue_assignment_user ON dorify.dori_user_queue_assignment USING btree (user_id);

CREATE INDEX idx_user_site_assignment_user ON dorify.dori_user_site_assignment USING btree (user_id);

CREATE INDEX idx_user_status ON dorify.dori_user USING btree (is_active, locked_until);

CREATE UNIQUE INDEX uk_notification_edge_source ON dorify.dori_notification USING btree (source_installation_id, notification_id) WHERE (source_installation_id IS NOT NULL);

CREATE UNIQUE INDEX uk_notification_once ON dorify.dori_notification USING btree (registration_id, notification_type, channel);

CREATE UNIQUE INDEX uk_operator_session_queue_thread_active ON dorify.dori_operator_session USING btree (queue_id, thread_number) WHERE ((disconnected_at IS NULL) AND (thread_number IS NOT NULL));

CREATE UNIQUE INDEX uk_operator_session_queue_user_active ON dorify.dori_operator_session USING btree (queue_id, user_id) WHERE (disconnected_at IS NULL);

CREATE UNIQUE INDEX uk_person_id_site ON dorify.dori_person USING btree (person_id, site_id);

CREATE UNIQUE INDEX uk_person_site_email_active ON dorify.dori_person USING btree (site_id, lower((email)::text)) WHERE ((email IS NOT NULL) AND is_active);

CREATE UNIQUE INDEX uk_person_site_phone_active ON dorify.dori_person USING btree (site_id, phone_number) WHERE ((phone_number IS NOT NULL) AND is_active);

CREATE UNIQUE INDEX uk_queue_tier_default ON dorify.dori_queue_service_tier USING btree (queue_id) WHERE (is_default AND is_active);

CREATE UNIQUE INDEX uk_registration_person_open ON dorify.dori_registration USING btree (queue_id, person_id) WHERE ((status IN ('booked', 'waiting', 'in_progress')) AND is_active);

CREATE UNIQUE INDEX uk_user_email_active ON dorify.dori_user USING btree (lower((email)::text)) WHERE ((email IS NOT NULL) AND is_active);

CREATE INDEX idx_agent_command_inbox_status_received ON dorify_agent.command_inbox USING btree (status, received_at);

-- Triggers

CREATE TRIGGER estimation_registration_delete AFTER DELETE ON dorify.dori_registration REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();

CREATE TRIGGER estimation_registration_insert AFTER INSERT ON dorify.dori_registration REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();

CREATE TRIGGER estimation_registration_update AFTER UPDATE ON dorify.dori_registration REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION dorify.mark_estimation_inputs_dirty();

CREATE TRIGGER tracking_queue_update AFTER UPDATE ON dorify.dori_queue FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();

CREATE TRIGGER tracking_registration_insert AFTER INSERT ON dorify.dori_registration REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION dorify_agent.mark_registration_tracking_dirty();

CREATE TRIGGER tracking_registration_update AFTER UPDATE ON dorify.dori_registration REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION dorify_agent.mark_registration_tracking_dirty();

CREATE TRIGGER tracking_session_change AFTER INSERT OR DELETE OR UPDATE ON dorify.dori_operator_session FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();

CREATE TRIGGER tracking_site_priority_update AFTER UPDATE OF default_base_weight_walkin, default_base_weight_appointment, default_escalation_rate_walkin, default_escalation_rate_appointment, timezone ON dorify.dori_site FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_site_tracking_dirty();

CREATE TRIGGER tracking_stats_change AFTER INSERT OR DELETE OR UPDATE ON dorify.dori_queue_estimation_stats FOR EACH ROW EXECUTE FUNCTION dorify_agent.mark_queue_tracking_dirty();

CREATE TRIGGER trg_audit_event_append_only BEFORE DELETE OR UPDATE ON dorify.dori_audit_event FOR EACH ROW EXECUTE FUNCTION dorify.dori_reject_audit_event_mutation();

CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON dorify.dori_notification FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_permission_updated_at BEFORE UPDATE ON dorify.dori_permission FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_person_note_updated_at BEFORE UPDATE ON dorify.dori_person_note FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_person_updated_at BEFORE UPDATE ON dorify.dori_person FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_queue_service_tier_updated_at BEFORE UPDATE ON dorify.dori_queue_service_tier FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_queue_updated_at BEFORE UPDATE ON dorify.dori_queue FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_registration_person_site BEFORE INSERT OR UPDATE OF person_id, queue_id ON dorify.dori_registration FOR EACH ROW EXECUTE FUNCTION dorify.dori_check_registration_person_site();

CREATE CONSTRAINT TRIGGER trg_registration_served_by AFTER INSERT OR UPDATE OF served_by_session_id, served_by_user_id ON dorify.dori_registration DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dorify.dori_check_registration_served_by();

CREATE TRIGGER trg_registration_updated_at BEFORE UPDATE ON dorify.dori_registration FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_role_updated_at BEFORE UPDATE ON dorify.dori_role FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_service_tier_updated_at BEFORE UPDATE ON dorify.dori_service_tier FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_site_updated_at BEFORE UPDATE ON dorify.dori_site FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_tier_notification_rule_updated_at BEFORE UPDATE ON dorify.dori_queue_tier_notification_rule FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_translation_updated_at BEFORE UPDATE ON dorify.dori_translation FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON dorify.dori_user FOR EACH ROW EXECUTE FUNCTION dorify.dori_set_updated_at();

CREATE TRIGGER notify_tracking_dirty AFTER INSERT OR UPDATE ON dorify_agent.tracking_dirty_queue FOR EACH STATEMENT EXECUTE FUNCTION dorify_agent.notify_tracking_change();

-- Schema documentation

COMMENT ON SCHEMA dorify_agent IS 'Durable local state for the outbound-only Dorify edge agent.';

COMMENT ON TABLE dorify.dori_edge_command IS 'Allow-listed operational commands pulled by outbound-only Dorify agents.';

COMMENT ON TABLE dorify.dori_edge_installation IS 'Cloud inventory and credentials for autonomous Dorify intra installations.';

COMMENT ON COLUMN dorify.dori_edge_installation.deployment_type IS 'Deployment category managed by the cloud control plane.';

COMMENT ON COLUMN dorify.dori_edge_installation.deployment_status IS 'Authoritative cloud lifecycle status. Revoked installations remain blocked locally until cloud reactivation.';

COMMENT ON TABLE dorify.dori_public_tracking_state IS 'Universal public tracking read model used by cloud-native and relayed intra registrations.';

COMMENT ON TABLE dorify_agent.agent_state IS 'Agent cursors and other local synchronization state.';

COMMENT ON TABLE dorify_agent.command_inbox IS 'Idempotent inbox and execution results for cloud supervision commands.';

-- Restore application defaults

SET check_function_bodies = true;

SET search_path TO dorify, pg_catalog;
