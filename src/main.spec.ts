import * as fs from 'fs';
import * as path from 'path';

describe('Bootstrap — BOOT-001', () => {
  it('does not contain any temporary console.log or diagnostic logs in main.ts', () => {
    const mainContent = fs.readFileSync(
      path.resolve(__dirname, 'main.ts'),
      'utf8',
    );
    expect(mainContent).not.toMatch(/console\.log/);
    expect(mainContent).not.toMatch(/\[boot\]/);
  });
});
