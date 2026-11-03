import { presentQueueTier } from '../src/modules/service-tiers/service-tier.presenter';
import { strict as assert } from 'assert';
import { Client } from 'pg';
import { DataSource, EntityManager } from 'typeorm';
import { postgresClientConfig } from '../src/core/database/postgres-connection';
import { ServiceTiersRepository } from '../src/modules/service-tiers/service-tiers.repository';
import { RegistrationsTransaction } from '../src/modules/registrations/registrations.repository';

async function main() {
  const client = new Client(postgresClientConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'CREATE TEMP TABLE inactive_tier_fixture ON COMMIT DROP AS SELECT * FROM dorify.dori_service_tier',
    );
    await client.query(
      'CREATE TEMP TABLE inactive_association_fixture ON COMMIT DROP AS SELECT * FROM dorify.dori_queue_service_tier',
    );
    const fixture = (
      await client.query<{
        queue_id: string;
        tier_id: string;
      }>(`SELECT a.queue_id,a.tier_id FROM inactive_association_fixture a
      JOIN inactive_tier_fixture t USING(tier_id) WHERE a.is_active AND t.is_active AND NOT t.is_system LIMIT 1`)
    ).rows[0];
    assert.ok(fixture, 'A demo queue service is required');
    const query = async (sql: string, parameters?: unknown[]) =>
      (
        await client.query(
          sql
            .replaceAll(
              'dorify.dori_queue_service_tier',
              'pg_temp.inactive_association_fixture',
            )
            .replaceAll(
              'dorify.dori_service_tier',
              'pg_temp.inactive_tier_fixture',
            ),
          parameters,
        )
      ).rows;
    const repository = new ServiceTiersRepository({
      query,
    } as unknown as DataSource);
    const transaction = new RegistrationsTransaction({
      query,
    } as unknown as EntityManager);
    const input = {
      queueId: fixture.queue_id,
      sortField: 'display_order',
      sortOrder: 'ASC' as const,
      pageSize: 100,
      offset: 0,
    };
    const before = await repository.findQueueTierPage(input);
    assert.ok(
      await transaction.findOfferedTier(fixture.queue_id, fixture.tier_id),
    );
    await client.query(
      'UPDATE inactive_tier_fixture SET is_active=FALSE WHERE tier_id=$1',
      [fixture.tier_id],
    );
    const after = await repository.findQueueTierPage(input);
    assert.equal(after.total, before.total - 1);
    const detail = await repository.findQueueTier(
      fixture.queue_id,
      fixture.tier_id,
    );
    assert.ok(detail);
    const represented = presentQueueTier(detail);
    assert.ok(represented.tier);
    assert.equal(represented.tier.isActive, false);
    assert.ok(after.items.every((item) => item.tier_id !== fixture.tier_id));
    assert.equal(
      await transaction.findOfferedTier(fixture.queue_id, fixture.tier_id),
      null,
    );
    console.log(
      'PASS globally inactive service: absent from listing/count and rejected for new registrations',
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
