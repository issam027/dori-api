/**
 * scripts/db-init.ts
 *
 * Standalone script to initialize the Dori database schema and seed data.
 * Supports both local PostgreSQL and cloud-managed databases (Aiven, Neon, Supabase, etc.).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/db-init.ts [--seed] [--force]
 *
 * Options:
 *   --seed   Also run seed.sql (default: false)
 *   --force  Drop & recreate tables or database if supported
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, ClientConfig } from 'pg';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let DB_HOST = process.env.DB_HOST ?? 'localhost';
let DB_PORT = parseInt(process.env.DB_PORT ?? '5432', 10);
let DB_USER = process.env.DB_USER ?? 'postgres';
let DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
let DB_NAME = process.env.DB_NAME ?? 'dori';
let DB_ADMIN_NAME = process.env.DB_ADMIN_NAME ?? 'defaultdb';
let DB_SSL = process.env.DB_SSL === 'true';

// Parse DATABASE_URL if provided
if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    DB_HOST = parsed.hostname;
    DB_PORT = parseInt(parsed.port || '5432', 10);
    DB_USER = decodeURIComponent(parsed.username);
    DB_PASSWORD = decodeURIComponent(parsed.password);
    const dbPath = parsed.pathname.replace(/^\//, '');
    if (dbPath) {
      DB_NAME = dbPath;
      DB_ADMIN_NAME = dbPath;
    }
    if (
      parsed.searchParams.get('sslmode') === 'require' ||
      parsed.searchParams.get('ssl') === 'true'
    ) {
      DB_SSL = true;
    }
  } catch (err: any) {
    console.warn(`[db-init] Could not parse DATABASE_URL: ${err.message}`);
  }
}

// Managed cloud hosts (e.g. Aiven, Supabase, Neon) don't allow creating databases via script
const isCloudManaged =
  DB_HOST.includes('aivencloud.com') ||
  DB_HOST.includes('supabase.co') ||
  DB_HOST.includes('neon.tech');

const DB_SKIP_CREATE =
  process.env.DB_SKIP_CREATE === 'true' || isCloudManaged;

const args = process.argv.slice(2);
const runSeed = args.includes('--seed');
const force = args.includes('--force');

const SCHEMA_PATH = path.join(
  __dirname,
  '../src/core/database/sql/schema.sql',
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
  log(`Running ${label}…`);
  await client.query(sql);
  log(`${label} completed successfully.`);
}

async function main() {
  log(`Target Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT} (SSL: ${DB_SSL})`);

  if (!DB_SKIP_CREATE) {
    const adminClient = new Client(buildClientConfig(DB_ADMIN_NAME));

    try {
      log(`Connecting to admin database "${DB_ADMIN_NAME}"…`);
      await adminClient.connect();
      log('Connected to admin database.');

      const { rows } = await adminClient.query<{ datname: string }>(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [DB_NAME],
      );
      const dbExists = rows.length > 0;

      if (force && dbExists) {
        log(`--force flag set: dropping database "${DB_NAME}"…`);
        await adminClient.query(`DROP DATABASE "${DB_NAME}"`);
        log(`Database "${DB_NAME}" dropped.`);
      }

      if (!dbExists || force) {
        log(`Creating database "${DB_NAME}"…`);
        await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
        log(`Database "${DB_NAME}" created.`);
      } else {
        log(`Database "${DB_NAME}" already exists.`);
      }
    } finally {
      await adminClient.end();
    }
  } else {
    log(`Skipping CREATE DATABASE (DB_SKIP_CREATE=true or cloud-managed provider detected).`);
  }

  // Connect to target database and execute schema & seed
  const appClient = new Client(buildClientConfig(DB_NAME));

  try {
    log(`Connecting to target database "${DB_NAME}"…`);
    await appClient.connect();
    log(`Connected to target database "${DB_NAME}".`);

    if (force && DB_SKIP_CREATE) {
      log(`--force flag set on managed DB: resetting public schema…`);
      await appClient.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      log(`Public schema reset.`);
    }

    await execSqlFile(appClient, SCHEMA_PATH, 'schema.sql');

    if (runSeed) {
      await execSqlFile(appClient, SEED_PATH, 'seed.sql');
    } else {
      log('Seed skipped (pass --seed or run "npm run db:init:seed" to include it).');
    }

    log('Database initialisation complete!');
  } finally {
    await appClient.end();
  }
}

main().catch((e) => {
  err(e.message);
  process.exit(1);
});
