import { strict as assert } from 'assert';
import { Client } from 'pg';
import { monitoringSeriesQueries } from '../src/modules/monitoring/monitoring-series.query';
import { postgresClientConfig } from '../src/core/database/postgres-connection';

/** Uses temporary rows only; never changes application tables. */
async function main() {
  const client = new Client(postgresClientConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'CREATE TEMP TABLE report_period_fixture (LIKE dorify.dori_registration INCLUDING DEFAULTS) ON COMMIT DROP',
    );
    await client.query(
      "INSERT INTO report_period_fixture SELECT * FROM dorify.dori_registration WHERE status='served' LIMIT 1",
    );
    const sample = await client.query<{ queue_id: string }>(
      'SELECT queue_id FROM report_period_fixture',
    );
    assert.equal(sample.rowCount, 1, 'A served demo registration is required');
    await client.query(`UPDATE report_period_fixture SET
      created_at='2026-09-30T23:00:00Z', checked_in_at='2026-10-01T23:40:00Z',
      called_at='2026-10-01T23:50:00Z', served_at='2026-10-02T00:10:00Z', closed_at='2026-10-02T00:10:00Z'`);
    for (const narrow of [false, true]) {
      const statements = monitoringSeriesQueries({
        queueIds: [sample.rows[0].queue_id],
        from: narrow ? '2026-10-01T23:45:00Z' : '2026-10-01T00:00:00Z',
        to: narrow ? '2026-10-01T23:55:00Z' : '2026-10-03T00:00:00Z',
        bucket: 'day',
        timezone: 'UTC',
      });
      const query = async (index: number) =>
        client.query(
          statements[index].sql.replaceAll(
            'dorify.dori_registration',
            'pg_temp.report_period_fixture',
          ),
          statements[index].parameters,
        );
      const totals = (await query(0)).rows[0];
      const series = (await query(1)).rows;
      const byQueue = (await query(3)).rows;
      assert.equal(Number(totals.average_wait_minutes), 10);
      for (const rows of [series, byQueue]) {
        const calledDay = rows.find((row) =>
          new Date(row.period_start).toISOString().startsWith('2026-10-01'),
        );
        assert.ok(
          calledDay,
          'Call-only periods must appear in the queue series',
        );
        for (const metric of ['average', 'median', 'p90'])
          assert.equal(Number(calledDay[`${metric}_wait_minutes`]), 10);
        assert.equal(calledDay.average_service_minutes, null);
        if (!narrow) {
          const servedDay = rows.find((row) =>
            new Date(row.period_start).toISOString().startsWith('2026-10-02'),
          );
          assert.ok(servedDay);
          assert.equal(servedDay.average_wait_minutes, null);
          for (const metric of ['average', 'median', 'p90'])
            assert.equal(Number(servedDay[`${metric}_service_minutes`]), 20);
        }
      }
      console.log(
        `PASS report duration attribution: ${narrow ? 'call-only window' : 'cross-midnight'}`,
      );
    }
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
