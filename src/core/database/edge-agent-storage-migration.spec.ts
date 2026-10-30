import * as fs from 'fs';
import * as path from 'path';

describe('edge agent storage migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, 'sql', 'migrations', '008_edge_agent_storage.sql'),
    'utf8',
  );

  it('creates the durable agent state and command inbox outside the business schema', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS dorify_agent');
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS dorify_agent.agent_state',
    );
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS dorify_agent.command_inbox',
    );
    expect(migration).toContain('command_id UUID PRIMARY KEY');
    expect(migration).toContain('payload JSONB NOT NULL');
    expect(migration).toContain('result JSONB');
  });
});
