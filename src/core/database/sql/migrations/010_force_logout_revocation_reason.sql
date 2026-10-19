ALTER TABLE dori_user_session
  DROP CONSTRAINT IF EXISTS dori_user_session_revoked_reason_check;

ALTER TABLE dori_user_session
  ADD CONSTRAINT dori_user_session_revoked_reason_check
  CHECK (
    revoked_reason IN (
      'global_logout',
      'logout',
      'force_logout',
      'rotation',
      'account_disabled',
      'account_deleted',
      'password_changed',
      'admin'
    )
  );
