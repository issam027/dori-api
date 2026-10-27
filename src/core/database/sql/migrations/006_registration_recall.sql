ALTER TABLE dorify.dori_registration
  ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recall_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_registration_recall_count_non_negative'
      AND conrelid = 'dorify.dori_registration'::regclass
  ) THEN
    ALTER TABLE dorify.dori_registration
      ADD CONSTRAINT ck_registration_recall_count_non_negative
      CHECK (recall_count >= 0);
  END IF;
END
$$;
