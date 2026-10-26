import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import { postgresClientConfig } from '../src/core/database/postgres-connection';
import { seedDailyActivity } from '../src/core/database/daily-activity-seed';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const client = new Client(postgresClientConfig());
  await client.connect();
  try {
    const executedAt = new Date();
    const summaries = await seedDailyActivity(client, executedAt);
    if (summaries.length === 0) {
      process.stdout.write(
        '[daily-activity-seed] No active queue with an active service tier found.\n',
      );
      return;
    }
    for (const summary of summaries) {
      process.stdout.write(
        `[daily-activity-seed] site="${summary.siteName}" queue=${summary.queueCode} ` +
          `date=${summary.businessDate} waiting=${summary.waiting} ` +
          `served=${summary.served} no_show=${summary.noShow}\n`,
      );
    }
    process.stdout.write(
      `[daily-activity-seed] Completed at ${executedAt.toISOString()}.\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[daily-activity-seed] Failed: ${message}\n`);
  process.exitCode = 1;
});
