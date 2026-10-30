import * as fs from 'fs';
import * as path from 'path';

describe('edge control plane migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, 'sql', 'migrations', '009_edge_control_plane.sql'),
    'utf8',
  );

  it('stores only hashed credentials and allow-listed commands', () => {
    expect(migration).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    expect(migration).not.toMatch(/token\s+(TEXT|VARCHAR)/);
    expect(migration).toContain("'RUN_HEALTH_CHECK', 'SYNC_NOW'");
    expect(migration).toContain('REFERENCES dorify.dori_edge_installation');
  });
});
