import * as fs from 'fs';
import * as path from 'path';

describe('edge installation permission migration', () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      'sql',
      'migrations',
      '010_edge_installation_permission.sql',
    ),
    'utf8',
  );

  it('creates the dedicated permission and grants it only to root by default', () => {
    expect(migration).toContain("'edge_installation_manage'");
    expect(migration).toContain("role.role_name = 'root'");
    expect(migration).toContain(
      'ON CONFLICT (role_id, permission_id) DO NOTHING',
    );
    expect(migration).not.toContain("role.role_name = 'admin'");
  });
});
