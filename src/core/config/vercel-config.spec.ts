import * as fs from 'fs';
import * as path from 'path';

describe('Vercel deployment configuration', () => {
  const root = path.resolve(__dirname, '../../..');
  const config = JSON.parse(
    fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'),
  ) as {
    framework?: string;
    functions?: Record<string, unknown>;
    rewrites?: Array<{ source: string; destination: string }>;
  };

  it('lets Vercel auto-detect the NestJS function', () => {
    expect(config.framework).toBeUndefined();
    expect(config.functions).toBeUndefined();
  });

  it('does not use a global rewrite that can intercept the function itself', () => {
    expect(config.rewrites).toBeUndefined();
  });
});
