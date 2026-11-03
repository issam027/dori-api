import {
  databaseListenUrl,
  databaseRuntimeSettings,
} from './database-runtime-settings';

describe('database runtime budget', () => {
  it('counts API/agent listeners and reserves capacity', () => {
    expect(
      databaseRuntimeSettings({
        DB_API_INSTANCES: '4',
        DB_POOL_MAX: '12',
        DB_AGENT_INSTANCES: '2',
        DB_AGENT_POOL_MAX: '3',
        DB_WORKER_CONNECTIONS: '5',
      }),
    ).toMatchObject({
      allocatedConnections: 85,
      maxConnections: 100,
      poolMax: 12,
    });
  });
  it('sizes the default pool inside the declared scaling envelope', () => {
    expect(databaseRuntimeSettings({ DB_API_INSTANCES: '10' }).poolMax).toBe(7);
  });
  it('rejects over-allocation and unbounded timeouts', () => {
    expect(() =>
      databaseRuntimeSettings({ DB_API_INSTANCES: '10', DB_POOL_MAX: '10' }),
    ).toThrow('budget exceeded');
    expect(() => databaseRuntimeSettings({ DB_LOCK_TIMEOUT_MS: '0' })).toThrow(
      'DB_LOCK_TIMEOUT_MS',
    );
  });
  it('uses a direct session URL for Neon LISTEN', () => {
    expect(
      databaseListenUrl({
        DATABASE_URL:
          'postgresql://user:password@ep-example-pooler.eu-central-1.aws.neon.tech/db?sslmode=require',
      }),
    ).toContain('@ep-example.eu-central-1.aws.neon.tech/');
    expect(
      databaseListenUrl({
        DATABASE_URL: 'postgresql://localhost/db',
        DATABASE_LISTEN_URL: 'postgresql://listener/db',
      }),
    ).toBe('postgresql://listener/db');
  });
});
