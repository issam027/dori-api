import configuration, { validateEnvironment } from './configuration';

describe('validateEnvironment', () => {
  const valid = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-secure-secret-with-at-least-32-characters',
  };

  it('accepts a secure configuration', () => {
    expect(validateEnvironment(valid)).toBe(valid);
  });

  it.each([
    [{ ...valid, JWT_SECRET: undefined }, 'JWT_SECRET'],
    [{ ...valid, PORT: 'NaN' }, 'PORT'],
    [{ ...valid, DB_PORT: '70000' }, 'DB_PORT'],
    [{ ...valid, DATABASE_URL: 'not-a-url' }, 'DATABASE_URL'],
  ])('rejects an unsafe environment', (environment, message) => {
    expect(() => validateEnvironment(environment)).toThrow(message);
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
