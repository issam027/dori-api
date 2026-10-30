import * as fs from 'fs';
import * as path from 'path';

describe('edge installation admin grant migration', () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      'sql',
      'migrations',
      '011_grant_edge_permission_to_admin.sql',
    ),
    'utf8',
  );

  it('grants the permission to admin and root idempotently', () => {
    expect(migration).toContain("role.role_name IN ('root', 'admin')");
    expect(migration).toContain(
      "permission.permission_name = 'edge_installation_manage'",
    );
    expect(migration).toContain(
      'ON CONFLICT (role_id, permission_id) DO NOTHING',
    );
  });
});
