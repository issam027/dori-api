import * as fs from 'fs';
import * as path from 'path';

describe('consolidated database contract', () => {
  const directory = path.join(__dirname, 'sql', 'migrations');
  const sql = fs.readFileSync(
    path.join(directory, '001_schema_final.sql'),
    'utf8',
  );
  const seed = fs.readFileSync(path.join(__dirname, 'sql', 'seed.sql'), 'utf8');

  it('installs one complete baseline without historical column alterations', () => {
    expect(
      fs.readdirSync(directory).filter((file) => file.endsWith('.sql')),
    ).toEqual(['001_schema_final.sql']);
    expect(sql).not.toMatch(/^\s*ALTER TABLE/gim);
    expect(sql.match(/^CREATE TABLE /gm)).toHaveLength(36);
    expect(sql.match(/^CREATE FUNCTION /gm)).toHaveLength(18);
  });

  it('preserves durable agent state, hashed credentials and command expiration', () => {
    expect(sql).toContain('CREATE TABLE dorify_agent.agent_state');
    expect(sql).toContain('CREATE TABLE dorify_agent.command_inbox');
    expect(sql).toContain('token_hash character(64) NOT NULL');
    expect(sql).not.toMatch(/\btoken\s+(text|character varying)/i);
    expect(sql).toContain("'RUN_HEALTH_CHECK', 'SYNC_NOW'");
    expect(sql).toContain(
      "'pending', 'acknowledged', 'succeeded', 'failed', 'timedOut'",
    );
    expect(sql).toContain(
      'REFERENCES dorify.dori_edge_installation(installation_id)',
    );
    expect(sql).toContain("'active', 'revoked'");
  });

  it('keeps permission grants in the reference seed for admin and root', () => {
    expect(seed).toMatch(/'edge_installation_manage'[^\n]+\{admin\}/);
    expect(seed).toContain("WHERE r.role_name = 'root'");
    expect(sql).not.toMatch(/^INSERT INTO /m);
  });
});
