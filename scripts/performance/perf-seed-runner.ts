/**
 * PERF-01 dataset runner.
 *
 * Usage:
 *   npm run perf:seed           # inject (fails if the dataset already exists)
 *   npm run perf:seed:clean     # remove only PERF-01 data
 *   npm run perf:seed:refresh   # clean then inject with dates relative to today
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client, ClientConfig } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Action = 'inject' | 'clean' | 'refresh';

const action = (process.argv[2] ?? 'inject') as Action;
const supportedActions: Action[] = ['inject', 'clean', 'refresh'];

if (!supportedActions.includes(action)) {
  throw new Error(
    `Unsupported action "${action}". Expected: ${supportedActions.join(', ')}.`,
  );
}

function databaseConfig(): ClientConfig {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const sslRequired =
      url.searchParams.get('sslmode') === 'require' ||
      url.searchParams.get('ssl') === 'true';

    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'dori',
    ssl:
      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

async function executeFile(client: Client, filename: string): Promise<void> {
  const filePath = path.resolve(__dirname, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  process.stdout.write(`[perf-seed] Running ${filename}\n`);
  await client.query(sql);
}

async function printSummary(client: Client): Promise<void> {
  const result = await client.query<{
    sites: string;
    queues: string;
    persons: string;
    registrations: string;
    notifications: string;
    min_date: string | null;
    max_date: string | null;
  }>(`
    WITH perf_site AS (
      SELECT site_id FROM dorify.dori_site
      WHERE site_name LIKE 'PERF-01 - %'
    ), perf_queue AS (
      SELECT queue_id FROM dorify.dori_queue
      WHERE site_id IN (SELECT site_id FROM perf_site)
    ), perf_registration AS (
      SELECT registration_id, business_date FROM dorify.dori_registration
      WHERE queue_id IN (SELECT queue_id FROM perf_queue)
    )
    SELECT
      (SELECT COUNT(*) FROM perf_site)::text AS sites,
      (SELECT COUNT(*) FROM perf_queue)::text AS queues,
      (SELECT COUNT(*) FROM dorify.dori_person p WHERE p.site_id IN (SELECT site_id FROM perf_site))::text AS persons,
      (SELECT COUNT(*) FROM perf_registration)::text AS registrations,
      (SELECT COUNT(*) FROM dorify.dori_notification n WHERE n.registration_id IN (SELECT registration_id FROM perf_registration))::text AS notifications,
      (SELECT MIN(business_date)::text FROM perf_registration) AS min_date,
      (SELECT MAX(business_date)::text FROM perf_registration) AS max_date
  `);
  const summary = result.rows[0];
  process.stdout.write(
    `[perf-seed] sites=${summary.sites} queues=${summary.queues} ` +
      `persons=${summary.persons} registrations=${summary.registrations} ` +
      `notifications=${summary.notifications} dates=${summary.min_date ?? '-'}..${summary.max_date ?? '-'}\n`,
  );
}

async function main(): Promise<void> {
  const client = new Client(databaseConfig());
  client.on('notice', (notice) => {
    process.stdout.write(`[perf-seed] ${notice.message}\n`);
  });
  await client.connect();

  try {
    if (action === 'clean' || action === 'refresh') {
      await executeFile(client, 'perf-clean.sql');
    }
    if (action === 'inject' || action === 'refresh') {
      await executeFile(client, 'perf-seed.sql');
      await printSummary(client);
    }
    process.stdout.write(`[perf-seed] ${action} completed successfully.\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const details = error as {
    message?: string;
    code?: string;
    detail?: string;
    constraint?: string;
    position?: string;
    where?: string;
    table?: string;
    column?: string;
    dataType?: string;
  };
  const message =
    details.message ||
    [details.code, details.detail, details.constraint, details.position]
      .filter(Boolean)
      .join(' | ') ||
    String(error);
  process.stderr.write(
    `[perf-seed] ${action} failed: ${message}` +
      ` code=${details.code ?? '-'} detail=${details.detail ?? '-'} ` +
      `constraint=${details.constraint ?? '-'} position=${details.position ?? '-'} ` +
      `table=${details.table ?? '-'} column=${details.column ?? '-'} ` +
      `type=${details.dataType ?? '-'} where=${details.where ?? '-'}\n`,
  );
  process.exitCode = 1;
});
