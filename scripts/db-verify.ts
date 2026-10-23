import { Client, ClientConfig } from 'pg';
import * as dotenv from 'dotenv';
import { AUDIT_EVENT_READ_MODEL } from '../src/core/audit/audit.repository';

dotenv.config();

function clientConfig(): ClientConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
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

async function main(): Promise<void> {
  const client = new Client(clientConfig());
  await client.connect();
  try {
    const state = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM dori_schema_migration) AS migrations,
        (SELECT COUNT(*)::int FROM dori_translation
         WHERE translation_key IN (
           'sms.welcome', 'sms.welcome_with_tracking',
           'email.welcome', 'email.welcome_with_tracking',
           'sms.threshold', 'sms.threshold_with_tracking',
           'email.threshold', 'email.threshold_with_tracking'
         ) AND is_active) AS active_notification_templates,
        (SELECT COUNT(*)::int FROM dori_registration
         WHERE status IN ('in_progress','served','no_show')
           AND (served_by_session_id IS NULL OR served_by_user_id IS NULL)) AS invalid_served_by,
        (SELECT COUNT(*)::int FROM dori_registration
         WHERE status IN ('served','no_show','expired','cancelled')
           AND NOT is_active) AS terminal_registrations_marked_inactive,
        (SELECT COUNT(*)::int
         FROM dori_user_queue_assignment uq
         JOIN dori_queue q ON q.queue_id = uq.queue_id
         LEFT JOIN dori_user_site_assignment us
           ON us.user_id = uq.user_id AND us.site_id = q.site_id
         WHERE us.user_id IS NULL) AS queue_assignments_without_site,
        (SELECT COUNT(*)::int FROM dori_operator_session
         WHERE counter_name IS NOT NULL
           AND LENGTH(BTRIM(counter_name)) NOT BETWEEN 1 AND 100) AS invalid_counter_names,
        (to_regclass('public.dori_audit_event') IS NOT NULL) AS audit_table_exists,
        EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_audit_event_append_only'
            AND tgrelid = 'dori_audit_event'::regclass
            AND NOT tgisinternal
        ) AS audit_append_only_trigger_exists
    `);
    const constraints = await client.query<{ conname: string }>(`
      SELECT conname FROM pg_constraint
      WHERE conname IN (
        'ck_registration_served_by_pair',
        'ck_registration_served_by_status',
        'ck_notification_dispatchable',
        'ck_operator_session_counter_name'
      ) ORDER BY conname
    `);
    await client.query(`
      SELECT actor_display_name, target_display_name,
             secondary_target_display_name
      FROM ${AUDIT_EVENT_READ_MODEL}
      LIMIT 1
    `);
    process.stdout.write(
      `${JSON.stringify({
        state: { ...state.rows[0], audit_read_model_queryable: true },
        constraints: constraints.rows.map((row) => row.conname),
      })}\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
