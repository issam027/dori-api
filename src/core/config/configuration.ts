function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const jwtSecret = String(environment.JWT_SECRET ?? '');
  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET is required and must contain at least 32 characters',
    );
  }

  for (const [name, min, max] of [
    ['PORT', 1, 65535],
    ['DB_PORT', 1, 65535],
    ['REDIS_PORT', 1, 65535],
    ['REFRESH_TOKEN_EXPIRES_DAYS', 1, 365],
  ] as const) {
    if (environment[name] === undefined) continue;
    const value = Number(environment[name]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
  }

  if (environment.DATABASE_URL) {
    try {
      new URL(String(environment.DATABASE_URL));
    } catch {
      throw new Error('DATABASE_URL must be a valid URL');
    }
  }

  return environment;
}

export default () => {
  const webhookSecrets = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key, value]) => key.startsWith('WEBHOOK_SECRET_') && value)
      .map(([key, value]) => [
        key.slice('WEBHOOK_SECRET_'.length).toLowerCase(),
        value as string,
      ]),
  );

  let dbHost = process.env.DB_HOST ?? 'localhost';
  let dbPort = parseInteger('DB_PORT', process.env.DB_PORT, 5432);
  let dbUser = process.env.DB_USER ?? 'postgres';
  let dbPassword = process.env.DB_PASSWORD ?? 'postgres';
  let dbName = process.env.DB_NAME ?? 'dori';
  let dbSsl = process.env.DB_SSL === 'true';

  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      dbHost = parsed.hostname;
      dbPort = parseInteger('DATABASE_URL port', parsed.port, 5432);
      dbUser = decodeURIComponent(parsed.username);
      dbPassword = decodeURIComponent(parsed.password);
      dbName = parsed.pathname.replace(/^\//, '') || dbName;
      if (
        parsed.searchParams.get('sslmode') === 'require' ||
        parsed.searchParams.get('ssl') === 'true'
      ) {
        dbSsl = true;
      }
    } catch (error) {
      throw new Error(`Invalid DATABASE_URL: ${(error as Error).message}`);
    }
  }

  return {
    port: parseInteger('PORT', process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',

    database: {
      host: dbHost,
      port: dbPort,
      username: dbUser,
      password: dbPassword,
      name: dbName,
      ssl: dbSsl,
    },

    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInteger('REDIS_PORT', process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD,
    },

    jwt: {
      privateKey: process.env.JWT_PRIVATE_KEY,
      publicKey: process.env.JWT_PUBLIC_KEY,
      secret: process.env.JWT_SECRET,
      accessTokenExpiresIn: '60m',
      refreshTokenExpiresInDays: parseInteger(
        'REFRESH_TOKEN_EXPIRES_DAYS',
        process.env.REFRESH_TOKEN_EXPIRES_DAYS,
        30,
      ),
    },

    cors: {
      allowedOrigins: (
        process.env.CORS_ORIGINS ??
        'http://localhost:3001,http://localhost:5173'
      )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },

    throttle: {
      default: {
        ttl: 60_000,
        limit: 200,
      },
      strict: {
        ttl: 60_000,
        limit: 20,
      },
      auth: {
        ttl: 60_000,
        limit: 10,
      },
    },

    notifications: {
      scopeCacheTtlSeconds: 30,
      webhookSecrets,
      webhookMaxAgeSeconds: parseInteger(
        'WEBHOOK_MAX_AGE_SECONDS',
        process.env.WEBHOOK_MAX_AGE_SECONDS,
        300,
      ),
    },

    databaseInitialization: {
      autoRunMigrations: process.env.AUTO_RUN_MIGRATIONS === 'true',
    },

    tracking: {
      closedGraceMinutes: 60,
    },

    security: {
      maxFailedAttempts: 5,
      lockoutMinutes: 15,
      minPasswordLength: 10,
      bcryptRounds: 12,
    },

    appointmentExpiry: {
      intervalMinutes: 5,
    },
  };
};
