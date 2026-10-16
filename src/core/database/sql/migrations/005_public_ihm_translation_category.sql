ALTER TABLE dori_translation
  DROP CONSTRAINT IF EXISTS dori_translation_category_check;

ALTER TABLE dori_translation
  ADD CONSTRAINT dori_translation_category_check
  CHECK (category IN ('ihm', 'public_ihm', 'sms', 'email', 'error'));

ALTER TABLE dori_translation_category_version
  DROP CONSTRAINT IF EXISTS dori_translation_category_version_category_check;

ALTER TABLE dori_translation_category_version
  ADD CONSTRAINT dori_translation_category_version_category_check
  CHECK (category IN ('ihm', 'public_ihm', 'sms', 'email', 'error'));

INSERT INTO dori_translation_category_version (category, version)
VALUES ('public_ihm', 1)
ON CONFLICT (category) DO NOTHING;
