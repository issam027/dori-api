import { ClientConfig } from 'pg';

export interface PostgresConnectionSettings {
  url: string;
  ssl: false | { rejectUnauthorized: false };
}

export function postgresConnectionSettings(
  environment: NodeJS.ProcessEnv = process.env,
): PostgresConnectionSettings {
  const value = environment.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      'DATABASE_URL is required (example: postgresql://user:password@localhost:5432/dori)',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL protocol must be postgres: or postgresql:');
  }
  if (!parsed.hostname || !parsed.pathname.replace(/^\//, '')) {
    throw new Error('DATABASE_URL must include a host and database name');
  }

  const sslRequired =
    parsed.searchParams.get('sslmode') === 'require' ||
    parsed.searchParams.get('ssl') === 'true' ||
    parsed.hostname.endsWith('.neon.tech');

  return {
    url: value,
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  };
}

export function postgresClientConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ClientConfig {
  const connection = postgresConnectionSettings(environment);
  return {
    connectionString: connection.url,
    ssl: connection.ssl,
  };
}
