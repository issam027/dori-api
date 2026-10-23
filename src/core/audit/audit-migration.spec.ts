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

  it('creates an append-only table guarded against updates and deletes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS dori_audit_event');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('trg_audit_event_append_only');
  });
});
