import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client, ClientConfig } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function config(): ClientConfig {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const ssl = url.searchParams.get('sslmode') === 'require';
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
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

const queries = {
  personsSearch: `
    SELECT p.* FROM dorify.dori_person p
    WHERE p.site_id = $1 AND p.is_active = TRUE
      AND (p.last_name ILIKE '%Perf-%' OR p.first_name ILIKE '%Perf-%'
        OR p.email ILIKE '%Perf-%' OR p.phone_number ILIKE '%Perf-%')
    ORDER BY p.created_at DESC LIMIT 50`,
  registrationsList: `
    SELECT r.registration_id, r.business_date, r.status, p.last_name, q.queue_name
    FROM dorify.dori_registration r
    JOIN dorify.dori_person p ON p.person_id = r.person_id
    JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
    WHERE q.site_id = $1 AND r.business_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE
      AND r.is_active = TRUE
    ORDER BY r.created_at DESC LIMIT 50`,
  notificationsList: `
    SELECT n.notification_id, n.notification_status, n.created_at
    FROM dorify.dori_notification n
    JOIN dorify.dori_registration r ON r.registration_id = n.registration_id
    JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
    WHERE q.site_id = $1 AND n.created_at >= CURRENT_DATE - INTERVAL '60 days'
    ORDER BY n.created_at DESC LIMIT 50`,
  reportSeries: `
    SELECT date_trunc('day', r.created_at) bucket, r.status, COUNT(*),
      AVG(EXTRACT(EPOCH FROM (r.called_at - r.checked_in_at)))
    FROM dorify.dori_registration r
    JOIN dorify.dori_queue q ON q.queue_id = r.queue_id
    WHERE q.site_id = $1 AND r.created_at >= CURRENT_DATE - INTERVAL '60 days'
      AND r.created_at < CURRENT_DATE + INTERVAL '1 day'
    GROUP BY 1, 2 ORDER BY 1`,
  callNextCandidate: `
    SELECT r.registration_id FROM dorify.dori_registration r
    WHERE r.queue_id = $1 AND r.business_date = CURRENT_DATE
      AND r.status = 'waiting' AND r.is_active = TRUE
    ORDER BY r.priority_reference_time, r.created_at
    LIMIT 1 FOR UPDATE SKIP LOCKED`,
} as const;

async function main(): Promise<void> {
  const client = new Client(config());
  await client.connect();
  try {
    const ids = await client.query<{ site_id: string; queue_id: string }>(`
      SELECT s.site_id, MIN(q.queue_id::text)::uuid queue_id
      FROM dorify.dori_site s JOIN dorify.dori_queue q ON q.site_id=s.site_id
      WHERE s.site_name LIKE 'PERF-01 - %' GROUP BY s.site_id ORDER BY s.site_id LIMIT 1`);
    if (!ids.rows[0]) throw new Error('PERF-01 dataset not found.');
    const plans: Record<string, unknown> = {};
    for (const [name, sql] of Object.entries(queries)) {
      const result = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
        [
          name === 'callNextCandidate'
            ? ids.rows[0].queue_id
            : ids.rows[0].site_id,
        ],
      );
      const explain = result.rows[0]['QUERY PLAN'][0];
      plans[name] = explain;
      process.stdout.write(
        `[perf-explain] ${name} execution=${explain['Execution Time']}ms planning=${explain['Planning Time']}ms\n`,
      );
    }
    const directory = path.resolve(__dirname, '../../reports/performance');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'explain-latest.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), plans }, null, 2)}\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[perf-explain] ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
