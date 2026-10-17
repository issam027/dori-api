ALTER TABLE dori_user
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);

UPDATE dori_user
SET full_name = username
WHERE full_name IS NULL;
