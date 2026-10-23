import * as fs from 'fs';
import * as path from 'path';

describe('audit migration hardening', () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'database',
      'sql',
      'migrations',
      '015_audit_events.sql',
    ),
    'utf8',
  );
  const scopeMigration = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'database',
      'sql',
      'migrations',
      '016_audit_site_scope.sql',
    ),
    'utf8',
  );

  it('creates an append-only table guarded against updates and deletes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS dori_audit_event');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('trg_audit_event_append_only');
  });

  it('adds, backfills and indexes the immutable site scope', () => {
    expect(scopeMigration).toContain('ADD COLUMN IF NOT EXISTS site_scope_id');
    expect(scopeMigration).toContain('DISABLE TRIGGER');
    expect(scopeMigration).toContain('ENABLE TRIGGER');
    expect(scopeMigration).toContain('idx_audit_event_site_time');
  });
});
