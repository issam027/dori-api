import * as fs from 'fs';
import * as path from 'path';

describe('edge installation revocation migration', () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      'sql',
      'migrations',
      '013_edge_installation_revocation.sql',
    ),
    'utf8',
  );

  it('migrates inactive installations and restricts future lifecycle values', () => {
    expect(migration).toContain("SET deployment_status = 'revoked'");
    expect(migration).toContain("'active', 'revoked'");
  });
});
