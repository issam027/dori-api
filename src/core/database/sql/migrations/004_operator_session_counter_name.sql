ALTER TABLE dori_operator_session
  ADD COLUMN IF NOT EXISTS counter_name VARCHAR(100);

ALTER TABLE dori_operator_session
  DROP CONSTRAINT IF EXISTS ck_operator_session_counter_name;

ALTER TABLE dori_operator_session
  ADD CONSTRAINT ck_operator_session_counter_name
  CHECK (
    counter_name IS NULL
    OR LENGTH(BTRIM(counter_name)) BETWEEN 1 AND 100
  );
