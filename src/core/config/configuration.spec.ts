import configuration, { validateEnvironment } from './configuration';

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeAll(() => {
  process.env.DATABASE_URL =
    originalDatabaseUrl ?? 'postgresql://dori:password@localhost:5432/dori';
});

afterAll(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('validateEnvironment', () => {
  const valid = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-secure-secret-with-at-least-32-characters',
    DATABASE_URL: 'postgresql://dori:password@localhost:5432/dori',
  };

  it('accepts a secure configuration', () => {
    expect(validateEnvironment(valid)).toBe(valid);
  });

  it.each([
    [{ ...valid, JWT_SECRET: undefined }, 'JWT_SECRET'],
    [{ ...valid, PORT: 'NaN' }, 'PORT'],
    [{ ...valid, DB_POOL_MAX: '0' }, 'DB_POOL_MAX'],
    [{ ...valid, DATABASE_URL: 'not-a-url' }, 'DATABASE_URL'],
    [{ ...valid, DATABASE_URL: 'https://example.com/dori' }, 'protocol'],
    [{ ...valid, PUBLIC_WEB_URL: 'ftp://example.com' }, 'PUBLIC_WEB_URL'],
    [{ ...valid, DORIFY_DEPLOYMENT_MODE: 'hybrid' }, 'DORIFY_DEPLOYMENT_MODE'],
  ])('rejects an unsafe environment', (environment, message) => {
    expect(() => validateEnvironment(environment)).toThrow(message);
  });
});

describe('configuration public tracking URL', () => {
  it('exposes the configured web application URL', () => {
    const original = process.env.PUBLIC_WEB_URL;
    try {
      process.env.PUBLIC_WEB_URL = 'https://app.dori.example';
      expect(configuration().tracking.publicWebUrl).toBe(
        'https://app.dori.example',
      );
    } finally {
      if (original === undefined) delete process.env.PUBLIC_WEB_URL;
      else process.env.PUBLIC_WEB_URL = original;
    }
  });
});

describe('configuration — CORE-004', () => {
  it('exposes platform.isVercel from process.env.VERCEL', () => {
    const originalVercel = process.env.VERCEL;
    try {
      delete process.env.VERCEL;
      expect(configuration().platform.isVercel).toBe(false);

      process.env.VERCEL = '1';
      expect(configuration().platform.isVercel).toBe(true);
    } finally {
      if (originalVercel !== undefined) {
        process.env.VERCEL = originalVercel;
      } else {
        delete process.env.VERCEL;
      }
    }
  });
});
