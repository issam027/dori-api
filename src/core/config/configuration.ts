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
  let dbPort = parseInt(process.env.DB_PORT ?? '5432', 10);
  let dbUser = process.env.DB_USER ?? 'postgres';
  let dbPassword = process.env.DB_PASSWORD ?? 'postgres';
  let dbName = process.env.DB_NAME ?? 'dori';
  let dbSsl = process.env.DB_SSL === 'true';

  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      dbHost = parsed.hostname;
      dbPort = parseInt(parsed.port || '5432', 10);
      dbUser = decodeURIComponent(parsed.username);
      dbPassword = decodeURIComponent(parsed.password);
      dbName = parsed.pathname.replace(/^\//, '') || dbName;
      if (
        parsed.searchParams.get('sslmode') === 'require' ||
        parsed.searchParams.get('ssl') === 'true'
      ) {
        dbSsl = true;
      }
    } catch {
      // ignore parse error and use DB_* env variables
    }
  }

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
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
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },

    jwt: {
      privateKey: process.env.JWT_PRIVATE_KEY,
      publicKey: process.env.JWT_PUBLIC_KEY,
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      accessTokenExpiresIn: '60m',
      refreshTokenExpiresInDays: parseInt(
        process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '30',
        10,
      ),
    },

    cors: {
      allowedOrigins: (
        process.env.CORS_ORIGINS ??
        'http://localhost:3001,http://localhost:5173'
      ).split(','),
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
      defaultWebhookSecret:
        process.env.WEBHOOK_SECRET_DEFAULT ?? 'webhook-secret',
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
