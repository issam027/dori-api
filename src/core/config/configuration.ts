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
  const hasRsaPair = Boolean(
    environment.JWT_PRIVATE_KEY && environment.JWT_PUBLIC_KEY,
  );
  if (!hasRsaPair && jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET (32+ characters) or JWT_PRIVATE_KEY/JWT_PUBLIC_KEY is required',
    );
  }
  if (
    Boolean(environment.JWT_PRIVATE_KEY) !== Boolean(environment.JWT_PUBLIC_KEY)
  ) {
    throw new Error(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured together',
    );
  }

  for (const [name, min, max] of [
    ['PORT', 1, 65535],
    ['DB_PORT', 1, 65535],
    ['REDIS_PORT', 1, 65535],
    ['REFRESH_TOKEN_EXPIRES_DAYS', 1, 365],
    ['SECURITY_MAX_FAILED_ATTEMPTS', 1, 100],
    ['SECURITY_LOCKOUT_MINUTES', 1, 1440],
    ['SECURITY_BCRYPT_ROUNDS', 10, 15],
    ['THROTTLE_DEFAULT_TTL_MS', 1000, 3600000],
    ['THROTTLE_DEFAULT_LIMIT', 1, 100000],
    ['THROTTLE_STRICT_TTL_MS', 1000, 3600000],
    ['THROTTLE_STRICT_LIMIT', 1, 100000],
    ['THROTTLE_AUTH_TTL_MS', 1000, 3600000],
    ['THROTTLE_AUTH_LIMIT', 1, 100000],
    ['TRACKING_TOKEN_TTL_MINUTES', 1, 10080],
    ['TRACKING_CLOSED_GRACE_MINUTES', 0, 1440],
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

  if (environment.PUBLIC_WEB_URL) {
    try {
      const publicWebUrl = new URL(String(environment.PUBLIC_WEB_URL));
      if (!['http:', 'https:'].includes(publicWebUrl.protocol)) {
        throw new Error('unsupported protocol');
      }
    } catch {
      throw new Error('PUBLIC_WEB_URL must be a valid HTTP(S) URL');
    }
  }

  return environment;
}

function normalizePem(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, '\n');
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
    swaggerExport: process.env.SWAGGER_EXPORT === 'true',

    platform: {
      isVercel: !!process.env.VERCEL,
    },

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
      privateKey: normalizePem(process.env.JWT_PRIVATE_KEY),
      publicKey: normalizePem(process.env.JWT_PUBLIC_KEY),
      secret: process.env.JWT_SECRET,
      algorithm:
        process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY
          ? 'RS256'
          : 'HS256',
      accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '60m',
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
        ttl: parseInteger(
          'THROTTLE_DEFAULT_TTL_MS',
          process.env.THROTTLE_DEFAULT_TTL_MS,
          60_000,
        ),
        limit: parseInteger(
          'THROTTLE_DEFAULT_LIMIT',
          process.env.THROTTLE_DEFAULT_LIMIT,
          2000,
        ),
      },
      strict: {
        ttl: parseInteger(
          'THROTTLE_STRICT_TTL_MS',
          process.env.THROTTLE_STRICT_TTL_MS,
          60_000,
        ),
        limit: parseInteger(
          'THROTTLE_STRICT_LIMIT',
          process.env.THROTTLE_STRICT_LIMIT,
          2000,
        ),
      },
      auth: {
        ttl: parseInteger(
          'THROTTLE_AUTH_TTL_MS',
          process.env.THROTTLE_AUTH_TTL_MS,
          60_000,
        ),
        limit: parseInteger(
          'THROTTLE_AUTH_LIMIT',
          process.env.THROTTLE_AUTH_LIMIT,
          100,
        ),
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
      closedGraceMinutes: parseInteger(
        'TRACKING_CLOSED_GRACE_MINUTES',
        process.env.TRACKING_CLOSED_GRACE_MINUTES,
        60,
      ),
      tokenTtlMinutes: parseInteger(
        'TRACKING_TOKEN_TTL_MINUTES',
        process.env.TRACKING_TOKEN_TTL_MINUTES,
        1440,
      ),
      publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
    },

    security: {
      maxFailedAttempts: parseInteger(
        'SECURITY_MAX_FAILED_ATTEMPTS',
        process.env.SECURITY_MAX_FAILED_ATTEMPTS,
        5,
      ),
      lockoutMinutes: parseInteger(
        'SECURITY_LOCKOUT_MINUTES',
        process.env.SECURITY_LOCKOUT_MINUTES,
        15,
      ),
      minPasswordLength: 10,
      bcryptRounds: parseInteger(
        'SECURITY_BCRYPT_ROUNDS',
        process.env.SECURITY_BCRYPT_ROUNDS,
        12,
      ),
    },

    appointmentExpiry: {
      intervalMinutes: 5,
    },
  };
};
