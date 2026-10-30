import * as fs from 'fs';
import * as path from 'path';

describe('edge installation deployment status migration', () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      'sql',
      'migrations',
      '012_edge_installation_deployment_status.sql',
    ),
    'utf8',
  );

  it('adds an explicit intra type and independently controllable lifecycle', () => {
    expect(migration).toContain("DEFAULT 'intra'");
    expect(migration).toContain("DEFAULT 'active'");
    expect(migration).toContain("'active', 'inactive'");
  });
});
