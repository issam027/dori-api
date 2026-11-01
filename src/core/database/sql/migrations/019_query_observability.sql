-- PostgreSQL must preload pg_stat_statements (configured in Docker Compose).
-- Managed providers retain control of preload settings.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
