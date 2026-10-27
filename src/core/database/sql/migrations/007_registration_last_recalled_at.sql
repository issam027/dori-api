DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'dorify'
      AND table_name = 'dori_registration'
      AND column_name = 'recalled_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'dorify'
      AND table_name = 'dori_registration'
      AND column_name = 'last_recalled_at'
  ) THEN
    ALTER TABLE dorify.dori_registration
      RENAME COLUMN recalled_at TO last_recalled_at;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'dorify'
      AND table_name = 'dori_registration'
      AND column_name = 'recalled_at'
  ) THEN
    UPDATE dorify.dori_registration
    SET last_recalled_at = COALESCE(last_recalled_at, recalled_at)
    WHERE recalled_at IS NOT NULL;

    ALTER TABLE dorify.dori_registration DROP COLUMN recalled_at;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'dorify'
      AND table_name = 'dori_registration'
      AND column_name = 'last_recalled_at'
  ) THEN
    ALTER TABLE dorify.dori_registration
      ADD COLUMN last_recalled_at TIMESTAMPTZ;
  END IF;
END
$$;
