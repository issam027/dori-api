/* Local-only fixture. Refuses every database except the dedicated performance ports. */
require('ts-node/register/transpile-only');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { runMigrations } = require('../../src/core/database/migration-runner');
const directory = path.resolve('.tmp-consolidation/performance');
const identity = JSON.parse(
  fs.readFileSync(path.join(directory, 'identity.json'), 'utf8'),
);
const tierId = '72f4df8f-557c-4409-9057-c20c7998579e';
const dbUrl = (kind) =>
  `postgresql://perf:perf_local_only@127.0.0.1:${kind === 'intra' ? 25432 : 65432}/dorify_perf`;
async function fixture(kind) {
  const client = new Client({
    connectionString: dbUrl(kind),
    statement_timeout: 120000,
  });
  await client.connect();
  try {
    const migrationConnection = {
      query: (sql, args) => client.query(sql, args),
      transaction: async (work) => {
        await client.query('BEGIN');
        try {
          const result = await work(migrationConnection);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      },
    };
    await runMigrations(
      migrationConnection,
      path.resolve('src/core/database/sql/migrations'),
      () => undefined,
    );
    await client.query(
      fs.readFileSync('src/core/database/sql/seed.sql', 'utf8'),
    );
    const password = crypto.randomBytes(16).toString('hex');
    await client.query(
      "UPDATE dorify.dori_user SET password_hash=$1,must_change_password=false WHERE username='root'",
      [await bcrypt.hash(password, 10)],
    );
    const root = (
      await client.query(
        "SELECT user_id FROM dorify.dori_user WHERE username='root'",
      )
    ).rows[0].user_id;
    const site = (
      await client.query(
        "INSERT INTO dorify.dori_site(site_name,default_appointments_enabled,default_working_days,default_break_start,default_break_end) VALUES ('PERF isolated Tunis',true,ARRAY[1,2,3,4,5,6,7],NULL,NULL) RETURNING site_id",
      )
    ).rows[0].site_id;
    const queues = {};
    for (const [name, capacity] of [
      ['live', 500],
      ['booking', 500],
      ['contended', 5],
      ['history', 500],
    ]) {
      const queue = (
        await client.query(
          "INSERT INTO dorify.dori_queue(site_id,queue_code,queue_name,appointments_enabled,slot_capacity,working_days,working_hours_start,working_hours_end,break_start,break_end) VALUES ($1,$2,$2,true,$3,ARRAY[1,2,3,4,5,6,7],'00:00','23:59',NULL,NULL) RETURNING queue_id",
          [site, name, capacity],
        )
      ).rows[0].queue_id;
      queues[name] = queue;
      await client.query(
        'INSERT INTO dorify.dori_queue_service_tier(queue_id,tier_id,is_default) VALUES ($1,$2,true)',
        [queue, tierId],
      );
    }
    const people = (
      await client.query(
        "INSERT INTO dorify.dori_person(site_id,first_name,last_name,phone_number) SELECT $1,'Client','PERF-'||g,'+2165'||lpad(g::text,7,'0') FROM generate_series(1,3000) g RETURNING person_id",
        [site],
      )
    ).rows.map((row) => row.person_id);
    const session = (
      await client.query(
        "INSERT INTO dorify.dori_operator_session(queue_id,user_id,thread_number,counter_name) VALUES ($1,$2,1,'PERF counter') RETURNING session_id",
        [queues.history, root],
      )
    ).rows[0].session_id;
    await client.query(
      `INSERT INTO dorify.dori_registration(person_id,queue_id,tier_id,business_date,ticket_number,entry_type,status,checked_in_at,priority_reference_time,called_at,served_at,served_by_session_id,served_by_user_id,registration_tracking_token_valid_until)
      SELECT ($1::uuid[])[1+(g%3000)::int],$2,$3,(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date-(g%90+1)::int,'H'||lpad(g::text,10,'0'),'walkin','served',
        CURRENT_TIMESTAMP-(g%90+1)*INTERVAL '1 day',CURRENT_TIMESTAMP-(g%90+1)*INTERVAL '1 day',
        CURRENT_TIMESTAMP-(g%90+1)*INTERVAL '1 day'+(g%40+2)*INTERVAL '1 minute',
        CURRENT_TIMESTAMP-(g%90+1)*INTERVAL '1 day'+(g%40+g%20+4)*INTERVAL '1 minute',$4,$5,CURRENT_TIMESTAMP-INTERVAL '1 day'
      FROM generate_series(1,100000) g`,
      [people, queues.history, tierId, session, root],
    );
    let registrations = [];
    if (kind === 'intra') {
      registrations = (
        await client.query(
          `INSERT INTO dorify.dori_registration(person_id,queue_id,tier_id,business_date,ticket_number,entry_type,status,checked_in_at,priority_reference_time,registration_tracking_token_valid_until,language_preference)
        SELECT ($1::uuid[])[g],$2,$3,(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date,'L'||lpad(g::text,8,'0'),'walkin','waiting',CURRENT_TIMESTAMP-INTERVAL '10 minutes',CURRENT_TIMESTAMP-INTERVAL '10 minutes',CURRENT_TIMESTAMP+INTERVAL '8 hours','fr'
        FROM generate_series(1,2000) g RETURNING registration_id,registration_tracking_token`,
          [people, queues.live, tierId],
        )
      ).rows;
      await client.query(
        'DELETE FROM dorify_agent.tracking_dirty_registration WHERE registration_id IN (SELECT registration_id FROM dorify.dori_registration WHERE queue_id=$1)',
        [queues.history],
      );
      await client.query(
        'DELETE FROM dorify_agent.tracking_dirty_queue WHERE queue_id=$1',
        [queues.history],
      );
      await client.query('SELECT dorify_agent.refresh_tracking()');
    } else {
      await client.query(
        "INSERT INTO dorify.dori_edge_installation(installation_id,installation_name,token_hash,last_seen_at) VALUES ($1,'PERF isolated intra',$2,CURRENT_TIMESTAMP)",
        [
          identity.installationId,
          crypto.createHash('sha256').update(identity.cloudToken).digest('hex'),
        ],
      );
    }
    await client.query('ANALYZE');
    const dates = (
      await client.query(
        "SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date+1)::text AS tomorrow,((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date)::text AS today",
      )
    ).rows[0];
    console.log(
      kind +
        ': 100000 historical registrations, ' +
        registrations.length +
        ' live tickets, isolated data ready',
    );
    return { site, queues, people, registrations, password, tierId, ...dates };
  } finally {
    await client.end();
  }
}
(async () => {
  if (fs.existsSync(path.join(directory, 'fixture.json')))
    throw new Error(
      'Fixture already exists; stop/recreate the isolated databases for another clean run',
    );
  const fixtures = {
    intra: await fixture('intra'),
    cloud: await fixture('cloud'),
  };
  fs.writeFileSync(
    path.join(directory, 'fixture.json'),
    JSON.stringify(fixtures),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
