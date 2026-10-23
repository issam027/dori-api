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
      '001_uuid_baseline.sql',
    ),
    'utf8',
  );
  it('creates an append-only table guarded against updates and deletes', () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS dorify.dori_audit_event',
    );
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('trg_audit_event_append_only');
  });

  it('declares and indexes the immutable UUID site scope directly', () => {
    expect(migration).toContain(
      'site_scope_id UUID REFERENCES dorify.dori_site(site_id)',
    );
    expect(migration).toContain('idx_audit_event_site_time');
  });
});
