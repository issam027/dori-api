-- Rename the public label only. Keep tier_id and the legacy 'free' code so
-- existing registrations, queue associations and external clients remain valid.
UPDATE dorify.dori_service_tier
SET tier_name = 'Basic', updated_at = CURRENT_TIMESTAMP
WHERE tier_code = 'free' AND tier_name IS DISTINCT FROM 'Basic';

-- Remote translation overrides must not restore the previous catalogue label.
WITH renamed AS (
  UPDATE dorify.dori_translation
  SET content = replace(replace(replace(content,
        'Gratuit', 'Basic'), 'Free', 'Basic'), 'مجاني', 'Basic'),
      updated_at = CURRENT_TIMESTAMP
  WHERE translation_key IN (
    'settings.tiersHelp',
    'onboarding.onboarding.aucunNiveauGratuitStandardOuPremiumActifN'
  )
    AND (content LIKE '%Gratuit%' OR content LIKE '%Free%' OR content LIKE '%مجاني%')
  RETURNING category
)
UPDATE dorify.dori_translation_category_version
SET version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE category IN (SELECT DISTINCT category FROM renamed);
