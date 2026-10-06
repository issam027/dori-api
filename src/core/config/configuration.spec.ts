import { validateEnvironment } from './configuration';

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
