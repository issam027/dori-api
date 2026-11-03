/* Operator tool. DATABASE_URL is supplied privately; backups are mandatory. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Client } = require('pg');
const { seedTunisiaDemo } = require('./seed-tunisia-demo.cjs');

async function main() {
  const [phase, target] = process.argv.slice(2);
  if (
    !['backup', 'rebuild', 'verify'].includes(phase) ||
    !['intra', 'cloud', 'neon'].includes(target)
  )
    throw new Error(
      'Usage: rebuild-demo.cjs backup|rebuild|verify intra|cloud|neon',
    );
  const url = new URL(process.env.DATABASE_URL);
  if (target === 'neon') {
    if (!url.hostname.endsWith('.neon.tech') || url.pathname !== '/neondb')
      throw new Error('Unexpected Neon database');
    url.hostname = url.hostname.replace('-pooler.', '.');
    url.searchParams.set('sslmode', 'verify-full');
  } else if (
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/dori' ||
    url.port !== (target === 'intra' ? '15432' : '55432')
  )
    throw new Error('Unexpected Docker database');
  const directory = path.resolve('.tmp-consolidation');
  fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, `${target}-before-reset.backup`);
  if (phase === 'backup') {
    if (fs.existsSync(backup))
      throw new Error('Backup already exists; refusing to overwrite it');
    let bytes;
    if (target === 'neon') {
      const values = [
        url.hostname,
        decodeURIComponent(url.username),
        decodeURIComponent(url.password),
        url.pathname.slice(1),
      ];
      if (values.some((v) => /[\r\n]/.test(v)))
        throw new Error('Unsupported credential characters');
      const script =
        'read -r PGHOST; read -r PGUSER; read -r PGPASSWORD; read -r PGDATABASE; export PGHOST PGUSER PGPASSWORD PGDATABASE; export PGSSLMODE=verify-full; export PGSSLROOTCERT=system; exec pg_dump -Fc --no-owner --no-privileges';
      bytes = execFileSync(
        'docker',
        ['run', '--rm', '-i', 'postgres:18-alpine', 'sh', '-c', script],
        { input: values.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024 },
      );
    } else
      bytes = execFileSync(
        'docker',
        [
          'exec',
          `${target}-dorify-postgres-1`,
          'pg_dump',
          '-U',
          'dori',
          '-d',
          'dori',
          '-Fc',
          '--no-owner',
          '--no-privileges',
        ],
        { maxBuffer: 256 * 1024 * 1024 },
      );
    if (bytes.subarray(0, 5).toString() !== 'PGDMP')
      throw new Error('Invalid backup format');
    fs.writeFileSync(backup, bytes);
    fs.writeFileSync(
      `${backup}.json`,
      JSON.stringify(
        {
          target,
          createdAt: new Date().toISOString(),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
        null,
        2,
      ),
    );
    console.log(`${target}: sauvegarde créée (${bytes.length} octets)`);
    return;
  }
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    if (phase === 'rebuild') {
      const bytes = fs.readFileSync(backup),
        metadata = JSON.parse(fs.readFileSync(`${backup}.json`, 'utf8'));
      if (createHash('sha256').update(bytes).digest('hex') !== metadata.sha256)
        throw new Error('Backup checksum mismatch');
      const protectedBefore = (
        await client.query(
          "SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema NOT IN ('dorify','dorify_agent','public','pg_catalog','information_schema') ORDER BY 1,2",
        )
      ).rows;
      const baseline = fs.readFileSync(
        'src/core/database/sql/migrations/001_schema_final.sql',
        'utf8',
      );
      await client.query('BEGIN');
      try {
        await client.query(
          'DROP SCHEMA IF EXISTS dorify_agent CASCADE; DROP SCHEMA IF EXISTS dorify CASCADE',
        );
        await client.query(baseline);
        await client.query(
          'CREATE TABLE dorify.dori_schema_migration(filename varchar(255) PRIMARY KEY,checksum char(64) NOT NULL,executed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        );
        await client.query(
          'INSERT INTO dorify.dori_schema_migration(filename,checksum) VALUES ($1,$2)',
          [
            '001_schema_final.sql',
            createHash('sha256').update(baseline).digest('hex'),
          ],
        );
        for (const filename of fs
          .readdirSync('src/core/database/sql/migrations')
          .filter(
            (file) => file.endsWith('.sql') && file !== '001_schema_final.sql',
          )
          .sort()) {
          const sql = fs.readFileSync(
            path.join('src/core/database/sql/migrations', filename),
            'utf8',
          );
          await client.query(sql);
          await client.query(
            'INSERT INTO dorify.dori_schema_migration(filename,checksum) VALUES ($1,$2)',
            [filename, createHash('sha256').update(sql).digest('hex')],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      await client.query(
        fs.readFileSync('src/core/database/sql/seed.sql', 'utf8'),
      );
      const summary = await seedTunisiaDemo(client, {
        kind: target === 'intra' ? 'intra' : 'cloud',
        seed: target === 'neon' ? 20261103 : 20261102,
      });
      const protectedAfter = (
        await client.query(
          "SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema NOT IN ('dorify','dorify_agent','public','pg_catalog','information_schema') ORDER BY 1,2",
        )
      ).rows;
      if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter))
        throw new Error('Protected schema inventory changed');
      fs.writeFileSync(
        path.join(directory, `${target}-summary.json`),
        JSON.stringify(summary, null, 2),
      );
      console.log(
        JSON.stringify({ target, ...summary, protectedSchemasPreserved: true }),
      );
    }
    const counts = (
      await client.query(
        `SELECT (SELECT count(*) FROM dorify.dori_site) sites,(SELECT count(*) FROM dorify.dori_queue) queues,(SELECT count(*) FROM dorify.dori_person) persons,(SELECT count(*) FROM dorify.dori_registration) registrations,(SELECT count(*) FROM dorify.dori_schema_migration) migrations`,
      )
    ).rows[0];
    if (phase === 'verify') {
      const checks = (
        await client.query(
          fs.readFileSync(path.join(__dirname, 'verify-demo.sql'), 'utf8'),
        )
      ).rows[0];
      if (Object.values(checks).some((value) => Number(value) !== 0))
        throw new Error(`Demo integrity failed: ${JSON.stringify(checks)}`);
      if (
        Number(counts.sites) !== (target === 'intra' ? 1 : 10) ||
        Number(counts.migrations) !==
          fs
            .readdirSync('src/core/database/sql/migrations')
            .filter((file) => file.endsWith('.sql')).length
      )
        throw new Error('Unexpected site or migration count');
      const results = await client.query(
        fs.readFileSync(path.join(__dirname, 'schema-fingerprint.sql'), 'utf8'),
      );
      const catalog = results.at(-1).rows;
      fs.writeFileSync(
        path.join(directory, `${target}-catalog.json`),
        JSON.stringify(catalog, null, 2),
      );
      console.log(
        JSON.stringify({
          target,
          integrity: checks,
          catalogObjects: catalog.length,
        }),
      );
    }
    console.log(JSON.stringify({ target, ...counts }));
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
