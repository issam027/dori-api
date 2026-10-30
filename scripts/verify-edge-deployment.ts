import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { postgresClientConfig } from '../src/core/database/postgres-connection';

dotenv.config();

async function main(): Promise<void> {
  const client = new Client(postgresClientConfig());
  await client.connect();
  try {
    const migrations = await client.query<{ filename: string }>(`
      SELECT filename
      FROM dorify.dori_schema_migration
      WHERE filename IN (
        '008_edge_agent_storage.sql',
        '009_edge_control_plane.sql',
        '010_edge_installation_permission.sql',
        '011_grant_edge_permission_to_admin.sql',
        '012_edge_installation_deployment_status.sql',
        '013_edge_installation_revocation.sql'
      )
      ORDER BY filename
    `);
    const permissions = await client.query<{ role_name: string }>(`
      SELECT role.role_name
      FROM dorify.dori_role role
      JOIN dorify.dori_role_permission role_permission
        ON role_permission.role_id = role.role_id
      JOIN dorify.dori_permission permission
        ON permission.permission_id = role_permission.permission_id
      WHERE permission.permission_name = 'edge_installation_manage'
      ORDER BY role.role_name
    `);
    const schema = await client.query<{
      deployment_type: boolean;
      deployment_status: boolean;
      agent_state: boolean;
      status_constraint: string | null;
      invalid_statuses: number;
    }>(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='dorify' AND table_name='dori_edge_installation'
            AND column_name='deployment_type'
        ) AS deployment_type,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='dorify' AND table_name='dori_edge_installation'
            AND column_name='deployment_status'
        ) AS deployment_status,
        to_regclass('dorify_agent.agent_state') IS NOT NULL AS agent_state,
        (
          SELECT pg_get_constraintdef(oid)
          FROM pg_constraint
          WHERE conname='dori_edge_installation_deployment_status_check'
            AND conrelid='dorify.dori_edge_installation'::regclass
        ) AS status_constraint,
        (
          SELECT COUNT(*)::int
          FROM dorify.dori_edge_installation
          WHERE deployment_status NOT IN ('active', 'revoked')
        ) AS invalid_statuses
    `);

    const result = {
      migrations: migrations.rows.map((row) => row.filename),
      permissionRoles: permissions.rows.map((row) => row.role_name),
      schema: schema.rows[0],
    };
    const valid =
      result.migrations.length === 6 &&
      result.permissionRoles.includes('root') &&
      result.permissionRoles.includes('admin') &&
      result.schema.deployment_type &&
      result.schema.deployment_status &&
      result.schema.agent_state &&
      (result.schema.status_constraint ?? '').includes("'active'") &&
      (result.schema.status_constraint ?? '').includes("'revoked'") &&
      result.schema.invalid_statuses === 0;
    if (!valid)
      throw new Error(
        `Edge deployment verification failed: ${JSON.stringify(result)}`,
      );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
