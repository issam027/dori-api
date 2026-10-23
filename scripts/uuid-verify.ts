import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const failures: string[] = [];
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), 'utf8');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const migrationsDir = path.join(root, 'src/core/database/sql/migrations');
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'));
if (migrations.length !== 1 || migrations[0] !== '001_uuid_baseline.sql') {
  failures.push(`Expected one UUID baseline, found: ${migrations.join(', ')}`);
}

const baseline = read('src/core/database/sql/migrations/001_uuid_baseline.sql');
for (const [label, pattern] of [
  ['public schema reference', /\bpublic\./i],
  ['serial identifier', /\b(?:BIG)?SERIAL\b/i],
  [
    'numeric internal identifier',
    /\b(?:site|user|role|permission|queue|person|note|tier|rule|session|registration|notification|translation|estimation_stats)_id\s+(?:SMALLINT|INT|INTEGER|BIGINT)\b/i,
  ],
  ['concurrent index', /CREATE\s+INDEX\s+CONCURRENTLY/i],
] as const) {
  if (pattern.test(baseline)) failures.push(`Baseline contains ${label}.`);
}

const tsFiles = walk(path.join(root, 'src')).filter((file) =>
  file.endsWith('.ts'),
);
for (const file of tsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/PositiveIdParamPipe/.test(source))
    failures.push(`${relative}: legacy numeric ID pipe.`);
  if (/Number\([^\n)]*_[iI]d\)/.test(source))
    failures.push(`${relative}: numeric row ID conversion.`);
  if (/parseInt\([^\n)]*(?:Id|_id)/.test(source))
    failures.push(`${relative}: parseInt on internal ID.`);
  if (/PrimaryGeneratedColumn\(['"](?:increment|identity)['"]\)/.test(source))
    failures.push(`${relative}: numeric generated primary key.`);
  if (
    !relative.includes(`entities${path.sep}`) &&
    /(?<![A-Za-z0-9_.])\bdori_[a-z0-9_]+\b/.test(source)
  ) {
    failures.push(`${relative}: unqualified application table.`);
  }
}

for (const relative of [
  'src/core/database/sql/migrations/001_uuid_baseline.sql',
  'src/core/database/sql/seed.sql',
  'scripts/sample-data/example-site-september-october-2026.sql',
  'scripts/sample-data/cleanup-example-site-september-october-2026.sql',
]) {
  const sql = read(relative);
  if (/(?<![A-Za-z0-9_.])\bdori_[a-z0-9_]+\b/.test(sql)) {
    failures.push(`${relative}: unqualified application table.`);
  }
}

const opaqueIds = new Set([
  'eventId',
  'correlationId',
  'providerMessageId',
  'messageId',
]);
const openapi = JSON.parse(read('openapi.json')) as unknown;
const inspect = (value: unknown, key?: string): void => {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (
    key &&
    /Id$/.test(key) &&
    !opaqueIds.has(key) &&
    record.type === 'integer'
  ) {
    failures.push(`openapi.json: ${key} is still an integer.`);
  }
  for (const [childKey, child] of Object.entries(record))
    inspect(child, childKey);
};
inspect(openapi);

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('UUID static verification passed.\n');
