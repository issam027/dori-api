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
    CREATE SCHEMA IF NOT EXISTS dorify;
    CREATE TABLE IF NOT EXISTS dorify.dori_schema_migration (
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
    'SELECT filename, checksum FROM dorify.dori_schema_migration ORDER BY filename',
  )) as AppliedMigration[] | { rows: AppliedMigration[] };
  const appliedRows = rowsOf(appliedResult);
  const applied = new Map(
    appliedRows.map((row) => [row.filename, row.checksum]),
  );

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
        'INSERT INTO dorify.dori_schema_migration (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      );
    });
    log(`Applied migration ${filename}.`);
  }
}

function checksumText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function rowsOf<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}
