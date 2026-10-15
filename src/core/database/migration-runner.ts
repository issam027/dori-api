import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationConnection {
  query(sql: string, parameters?: unknown[]): Promise<any>;
  transaction<T>(
    work: (connection: MigrationConnection) => Promise<T>,
  ): Promise<T>;
}

export type MigrationLogger = (message: string) => void;

interface AppliedMigration {
  filename: string;
  checksum: string;
}

export async function runMigrations(
  connection: MigrationConnection,
  directory: string,
  log: MigrationLogger,
): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS dori_schema_migration (
      filename VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs
    .readdirSync(directory)
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();
  if (files.length === 0)
    throw new Error(`No SQL migration found in ${directory}`);

  const appliedResult = (await connection.query(
    'SELECT filename, checksum FROM dori_schema_migration ORDER BY filename',
  )) as AppliedMigration[] | { rows: AppliedMigration[] };
  const appliedRows = rowsOf(appliedResult);
  const applied = new Map(
    appliedRows.map((row) => [row.filename, row.checksum]),
  );

  // Databases initialized before versioned migrations already contain the baseline.
  if (applied.size === 0) {
    const existing = (await connection.query(
      `SELECT to_regclass('public.dori_registration') IS NOT NULL AS exists`,
    )) as Array<{ exists: boolean }> | { rows: Array<{ exists: boolean }> };
    if (rowsOf(existing)[0]?.exists) {
      const baseline = files[0];
      const checksum = checksumFile(path.join(directory, baseline));
      await connection.query(
        'INSERT INTO dori_schema_migration (filename, checksum) VALUES ($1, $2)',
        [baseline, checksum],
      );
      applied.set(baseline, checksum);
      log(`Baselined existing database at ${baseline}.`);
    }
  }

  for (const filename of files) {
    const filePath = path.join(directory, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = checksumText(sql);
    const previousChecksum = applied.get(filename);
    if (previousChecksum) {
      if (previousChecksum !== checksum) {
        throw new Error(`Applied migration ${filename} has been modified.`);
      }
      continue;
    }
    await connection.transaction(async (transaction) => {
      await transaction.query(sql);
      await transaction.query(
        'INSERT INTO dori_schema_migration (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      );
    });
    log(`Applied migration ${filename}.`);
  }
}

function checksumFile(filePath: string): string {
  return checksumText(fs.readFileSync(filePath, 'utf8'));
}

function checksumText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function rowsOf<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}
