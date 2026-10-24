import * as fs from 'fs';
import * as path from 'path';

describe('Vercel deployment configuration', () => {
  const root = path.resolve(__dirname, '../../..');
  const config = JSON.parse(
    fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'),
  ) as {
    functions: Record<string, unknown>;
    rewrites: Array<{ source: string; destination: string }>;
  };

  it('targets a discoverable function in the api directory', () => {
    expect(
      Object.prototype.hasOwnProperty.call(config.functions, 'api/index.ts'),
    ).toBe(true);
    expect(fs.existsSync(path.join(root, 'api/index.ts'))).toBe(true);
  });

  it('forwards every HTTP route to the Nest function', () => {
    expect(config.rewrites).toContainEqual({
      source: '/(.*)',
      destination: '/api',
    });
  });
});
