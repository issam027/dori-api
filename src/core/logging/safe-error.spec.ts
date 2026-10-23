import { safeErrorName } from './safe-error';

describe('safeErrorName', () => {
  it('returns only the error class and never its sensitive message', () => {
    const result = safeErrorName(new TypeError('token=secret phone=+331234'));
    expect(result).toBe('TypeError');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('+331234');
  });

  it('normalizes non Error values', () => {
    expect(safeErrorName('secret')).toBe('UnknownError');
  });
});
