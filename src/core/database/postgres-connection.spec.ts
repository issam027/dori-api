import {
  postgresClientConfig,
  postgresConnectionSettings,
} from './postgres-connection';

describe('PostgreSQL connection configuration', () => {
  it('uses one DATABASE_URL and enables TLS for Neon', () => {
    const url =
      'postgresql://user:password@ep-example-pooler.eu-central-1.aws.neon.tech/dori';

    expect(postgresConnectionSettings({ DATABASE_URL: url })).toEqual({
      url,
      ssl: { rejectUnauthorized: false },
    });
    expect(postgresClientConfig({ DATABASE_URL: url })).toEqual({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  });

  it('keeps TLS disabled for a local URL unless requested explicitly', () => {
    const url = 'postgresql://dori:password@localhost:5432/dori';
    expect(postgresConnectionSettings({ DATABASE_URL: url }).ssl).toBe(false);
  });

  it.each([
    [{}, 'DATABASE_URL is required'],
    [{ DATABASE_URL: 'not-a-url' }, 'valid PostgreSQL URL'],
    [{ DATABASE_URL: 'https://example.com/dori' }, 'protocol'],
    [{ DATABASE_URL: 'postgresql://localhost' }, 'database name'],
  ])('rejects invalid connection settings', (environment, message) => {
    expect(() => postgresConnectionSettings(environment)).toThrow(message);
  });
});
