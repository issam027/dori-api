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
      '001_schema_final.sql',
    ),
    'utf8',
  );
  it('creates an append-only table guarded against updates and deletes', () => {
    expect(migration).toContain('CREATE TABLE dorify.dori_audit_event');
    expect(migration).toMatch(/BEFORE (?:UPDATE OR DELETE|DELETE OR UPDATE)/);
    expect(migration).toContain('trg_audit_event_append_only');
  });

  it('declares and indexes the immutable UUID site scope directly', () => {
    expect(migration).toContain(
      'FOREIGN KEY (site_scope_id) REFERENCES dorify.dori_site(site_id)',
    );
    expect(migration).toContain('idx_audit_event_site_time');
  });
});
