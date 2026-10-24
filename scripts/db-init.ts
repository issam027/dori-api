/**
 * scripts/db-init.ts
 *
 * Standalone script to apply the Dori database migrations and seed data.
 * Supports both local PostgreSQL and cloud-managed databases (Aiven, Neon, Supabase, etc.).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/db-init.ts [--seed] [--force]
 *
 * Options:
 *   --seed   Also run seed.sql (default: false)
 *   --force  Drop and recreate only the dorify schema; public is untouched
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, ClientConfig } from 'pg';
import * as dotenv from 'dotenv';
import { runMigrations } from '../src/core/database/migration-runner';
import { postgresConnectionSettings } from '../src/core/database/postgres-connection';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connection = postgresConnectionSettings();
const parsedDatabaseUrl = new URL(connection.url);
const DB_HOST = parsedDatabaseUrl.hostname;
const DB_PORT = parseInt(parsedDatabaseUrl.port || '5432', 10);
const DB_USER = decodeURIComponent(parsedDatabaseUrl.username);
const DB_PASSWORD = decodeURIComponent(parsedDatabaseUrl.password);
const DB_NAME = parsedDatabaseUrl.pathname.replace(/^\//, '');
const DB_ADMIN_NAME = DB_NAME;
const DB_SSL = connection.ssl !== false;

// Managed cloud hosts (e.g. Aiven, Supabase, Neon) don't allow creating databases via script
const isCloudManaged =
  DB_HOST.includes('aivencloud.com') ||
  DB_HOST.includes('supabase.co') ||
  DB_HOST.includes('neon.tech');

const DB_SKIP_CREATE = process.env.DB_SKIP_CREATE === 'true' || isCloudManaged;

const args = process.argv.slice(2);
const runSeed = args.includes('--seed');
const force = args.includes('--force');

const MIGRATIONS_PATH = path.join(
  __dirname,
  '../src/core/database/sql/migrations',
);
const SEED_PATH = path.join(__dirname, '../src/core/database/sql/seed.sql');

function log(msg: string) {
  process.stdout.write(`[db-init] ${msg}\n`);
}

function err(msg: string) {
  process.stderr.write(`[db-init] ${msg}\n`);
}

function buildClientConfig(database: string): ClientConfig {
  const cfg: ClientConfig = {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
  };
  if (DB_SSL) {
    cfg.ssl = { rejectUnauthorized: false };
  }
  return cfg;
}

async function execSqlFile(client: Client, filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    log(`${label}: file not found at ${filePath}, skipping.`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  log(
    `Running ${label}ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦`,
  );
  await client.query(sql);
  log(`${label} completed successfully.`);
}

async function snapshotPublicSchema(client: Client): Promise<string> {
  const { rows } = await client.query<{ fingerprint: string }>(`
    SELECT md5(COALESCE(string_agg(definition, E'\n' ORDER BY definition), '')) AS fingerprint
    FROM (
      SELECT 'object|' || c.relkind::text || '|' || c.relname AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'column|' || table_name || '|' || column_name || '|' || data_type || '|' || is_nullable || '|' || COALESCE(column_default, '')
      FROM information_schema.columns WHERE table_schema = 'public'
      UNION ALL
      SELECT 'constraint|' || con.conname || '|' || pg_get_constraintdef(con.oid, true)
      FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'index|' || indexname || '|' || indexdef
      FROM pg_indexes WHERE schemaname = 'public'
      UNION ALL
      SELECT 'function|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'trigger|' || t.tgname || '|' || pg_get_triggerdef(t.oid, true)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ) catalog
  `);
  return rows[0].fingerprint;
}
async function main() {
  log(`Target Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT} (SSL: ${DB_SSL})`);

  if (!DB_SKIP_CREATE && !force) {
    const adminClient = new Client(buildClientConfig(DB_ADMIN_NAME));

    try {
      log(
        `Connecting to admin database "${DB_ADMIN_NAME}"ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦`,
      );
      await adminClient.connect();
      log('Connected to admin database.');

      const { rows } = await adminClient.query<{ datname: string }>(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [DB_NAME],
      );
      const dbExists = rows.length > 0;

      if (!dbExists) {
        log(
          `Creating database "${DB_NAME}"ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦`,
        );
        await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
        log(`Database "${DB_NAME}" created.`);
      } else {
        log(`Database "${DB_NAME}" already exists.`);
      }
    } finally {
      await adminClient.end();
    }
  } else {
    log(
      `Skipping CREATE DATABASE (DB_SKIP_CREATE=true or cloud-managed provider detected).`,
    );
  }

  // Connect to target database and execute schema & seed
  const appClient = new Client(buildClientConfig(DB_NAME));

  try {
    log(
      `Connecting to target database "${DB_NAME}"ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦`,
    );
    await appClient.connect();
    log(`Connected to target database "${DB_NAME}".`);
    await appClient.query('SET search_path TO dorify, pg_catalog');
    const publicSchemaBefore = await snapshotPublicSchema(appClient);

    if (force) {
      log(
        `--force flag set: resetting dorify schema onlyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦`,
      );
      await appClient.query(
        `DROP SCHEMA IF EXISTS dorify CASCADE; CREATE SCHEMA dorify;`,
      );
      log(`Dorify schema reset; public schema was not modified.`);
    }

    await runMigrations(
      {
        query: (sql, parameters) => appClient.query(sql, parameters),
        transaction: async (work) => {
          await appClient.query('BEGIN');
          try {
            const result = await work({
              query: (sql, parameters) => appClient.query(sql, parameters),
              transaction: () => {
                throw new Error('Nested migrations are not supported.');
              },
            });
            await appClient.query('COMMIT');
            return result;
          } catch (error) {
            await appClient.query('ROLLBACK');
            throw error;
          }
        },
      },
      MIGRATIONS_PATH,
      log,
    );

    if (runSeed) {
      await execSqlFile(appClient, SEED_PATH, 'seed.sql');
    } else {
      log(
        'Seed skipped (pass --seed or run "npm run db:init:seed" to include it).',
      );
    }

    const publicSchemaAfter = await snapshotPublicSchema(appClient);
    if (publicSchemaAfter !== publicSchemaBefore) {
      throw new Error(
        'The public schema changed during dorify initialization.',
      );
    }
    log('Verified: public schema is unchanged.');
    log('Database initialisation complete!');
  } finally {
    await appClient.end();
  }
}

main().catch((e) => {
  err(` position=${e.position ?? 'unknown'}`);
  process.exit(1);
});
