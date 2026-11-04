/* Additive, persistent SaaS fixture. Only the local intra database is accepted. */
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const directory = path.resolve('.tmp-consolidation/saas-performance');
fs.mkdirSync(directory, { recursive: true });
const connectionString = fs
  .readFileSync(path.join(directory, 'database-url.txt'), 'utf8')
  .trim();
const target = new URL(connectionString);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '15432' ||
  target.pathname !== '/dori'
)
  throw new Error('Only the persistent local intra database is allowed');
const siteName = 'PERF SaaS - Tunis Centre 100K';
const first = [
  'Amine',
  'Inès',
  'Youssef',
  'Mariem',
  'Aziz',
  'Nour',
  'Walid',
  'Ons',
  'خليل',
  'آمنة',
  'سلمى',
  'أيمن',
];
const last = [
  'Ben Ali',
  'Trabelsi',
  'Mansour',
  'Gharbi',
  'Ayari',
  'Dridi',
  'Saïdi',
  'Khelifi',
  'بن صالح',
  'الهمامي',
];
(async () => {
  if (fs.existsSync(path.join(directory, 'fixture.json')))
    throw new Error('Persistent fixture already recorded; do not seed twice');
  const db = new Client({ connectionString, statement_timeout: 180000 });
  await db.connect();
  try {
    await db.query('BEGIN');
    if (
      (
        await db.query('SELECT 1 FROM dorify.dori_site WHERE site_name=$1', [
          siteName,
        ])
      ).rowCount
    )
      throw new Error(
        'Persistent site already exists; refusing to duplicate or replace it',
      );
    const before = Number(
      (await db.query('SELECT count(*) FROM dorify.dori_registration')).rows[0]
        .count,
    );
    const password = randomBytes(18).toString('base64url');
    const hash = await bcrypt.hash(password, 10);
    const accounts = [];
    for (let index = 0; index < 27; index++) {
      const username =
        index === 0
          ? 'pfs_admin'
          : index === 26
            ? 'pfs_root'
            : index === 1
              ? 'pfs_manager'
              : 'pfs_operator_' + String(index - 1).padStart(2, '0');
      const role =
        index === 26
          ? 'root'
          : index === 0
            ? 'admin'
            : index === 1
              ? 'manager'
              : 'operator';
      const user = (
        await db.query(
          "INSERT INTO dorify.dori_user(username,email,full_name,password_hash,user_type,language_preference,must_change_password) VALUES($1,$2,$3,$4,'human','fr',false) RETURNING user_id",
          [
            username,
            username + '@example.test',
            index < 2 ? 'Responsable PERF SaaS' : 'Agent PERF ' + (index - 1),
            hash,
          ],
        )
      ).rows[0].user_id;
      await db.query(
        'INSERT INTO dorify.dori_user_role(user_id,role_id) SELECT $1,role_id FROM dorify.dori_role WHERE role_name=$2',
        [user, role],
      );
      accounts.push({ username, userId: user, role, password });
    }
    const manager = accounts[1].userId;
    const site = (
      await db.query(
        "INSERT INTO dorify.dori_site(site_name,site_location,site_type,timezone,default_currency,default_locale,default_appointments_enabled,default_working_days,default_working_hours_start,default_working_hours_end,default_break_start,default_break_end,default_daily_reset_mode,default_carry_over_waiting,created_by_user_id) VALUES($1,'Centre-ville, Tunis','public','Africa/Tunis','TND','fr',true,ARRAY[1,2,3,4,5,6,7],'00:00','23:59',NULL,NULL,'carry_over_open',true,$2) RETURNING site_id",
        [siteName, manager],
      )
    ).rows[0].site_id;
    for (const account of accounts)
      await db.query(
        'INSERT INTO dorify.dori_user_site_assignment(user_id,site_id,assigned_by_user_id) VALUES($1,$2,$3)',
        [account.userId, site, manager],
      );
    const tiers = (
      await db.query(
        "SELECT tier_id,tier_code FROM dorify.dori_service_tier WHERE tier_code IN ('free','standard','premium') ORDER BY CASE tier_code WHEN 'free' THEN 0 WHEN 'standard' THEN 1 ELSE 2 END",
      )
    ).rows;
    if (tiers.length !== 3)
      throw new Error('Expected initial service tiers missing');
    const queues = [];
    for (const [index, name] of [
      'Accueil général',
      'État civil',
      'Démarches administratives',
      'Paiements',
      'Expertise',
      'Accompagnement social',
    ].entries()) {
      const id = (
        await db.query(
          "INSERT INTO dorify.dori_queue(site_id,queue_code,queue_name,thread_count,average_wait_time,appointments_enabled,appointment_slot_duration,slot_capacity,working_days,working_hours_start,working_hours_end,break_start,break_end,carry_over_waiting,daily_reset_mode,created_by_user_id) VALUES($1,$2,$3,4,10,true,15,8,ARRAY[1,2,3,4,5,6,7],'00:00','23:59',NULL,NULL,true,'carry_over_open',$4) RETURNING queue_id",
          [site, 'PF' + (index + 1), name, manager],
        )
      ).rows[0].queue_id;
      queues.push({ id, name, code: 'PF' + (index + 1) });
      for (const [tierIndex, tier] of tiers.entries())
        await db.query(
          'INSERT INTO dorify.dori_queue_service_tier(queue_id,tier_id,is_default,price) VALUES($1,$2,$3,$4)',
          [id, tier.tier_id, tierIndex === 0, [0, 5, 15][tierIndex]],
        );
      for (let slot = 0; slot < 4; slot++) {
        const account = accounts[2 + index * 4 + slot];
        account.queueId = id;
        account.threadNumber = slot + 1;
        await db.query(
          'INSERT INTO dorify.dori_user_queue_assignment(user_id,queue_id,assigned_by_user_id) VALUES($1,$2,$3)',
          [account.userId, id, manager],
        );
      }
    }
    const people = (
      await db.query(
        "INSERT INTO dorify.dori_person(site_id,first_name,last_name,phone_number,email,birth_date,language_preference,created_at,created_by_user_id) SELECT $1,($2::text[])[1+g%12],($3::text[])[1+g%10],'+21650'||lpad(g::text,6,'0'),'pfs.'||g||'@example.test',DATE '1960-01-01'+(g*97%22000),CASE g%4 WHEN 0 THEN 'ar-tn' WHEN 1 THEN 'ar' WHEN 2 THEN 'en' ELSE 'fr' END,CURRENT_TIMESTAMP-INTERVAL '110 days',$4 FROM generate_series(1,40000) g RETURNING person_id",
        [site, first, last, manager],
      )
    ).rows.map((row) => row.person_id);
    const sessions = [];
    const servedUsers = [];
    for (let q = 0; q < 6; q++)
      for (let op = 0; op < 2; op++) {
        const user = accounts[2 + q * 4 + op].userId;
        servedUsers.push(user);
        sessions.push(
          (
            await db.query(
              "INSERT INTO dorify.dori_operator_session(queue_id,user_id,thread_number,counter_name,connected_at,last_seen_at,disconnected_at,closure_reason) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP-INTERVAL '100 days',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'logout') RETURNING session_id",
              [queues[q].id, user, op + 1, 'Historique PERF ' + (op + 1)],
            )
          ).rows[0].session_id,
        );
      }
    await db.query(
      `CREATE TEMP TABLE pfs_rows ON COMMIT DROP AS
      WITH base AS (SELECT g,CASE WHEN g<=86000 THEN (g/90)%6 ELSE g%6 END AS qi,
        CASE WHEN g<=86000 THEN CASE g%20 WHEN 0 THEN 'no_show' WHEN 1 THEN 'no_show' WHEN 2 THEN 'cancelled' WHEN 3 THEN 'expired' ELSE 'served' END
          WHEN g<=94000 THEN 'booked' WHEN g<=97000 THEN 'waiting' WHEN g<=99000 THEN 'served' WHEN g<=99500 THEN 'no_show' ELSE 'cancelled' END AS status,
        CASE WHEN g BETWEEN 86001 AND 94000 OR g%5<2 THEN 'appointment' ELSE 'walkin' END AS entry_type,
        CASE WHEN g<=86000 THEN (((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date-(1+g%90))::timestamp+INTERVAL '9 hours 30 minutes'+((g/(90*6))%180)*INTERVAL '3 minutes') AT TIME ZONE 'Africa/Tunis'
          WHEN g<=94000 THEN (((CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date+(1+(g-86001)%30))::timestamp+INTERVAL '9 hours'+(((g-86001)/(30*6))%36)*INTERVAL '15 minutes') AT TIME ZONE 'Africa/Tunis'
          WHEN g<=97000 THEN CURRENT_TIMESTAMP-INTERVAL '45 minutes'+(g%30)*INTERVAL '1 minute'
          WHEN g<=99500 THEN CURRENT_TIMESTAMP-INTERVAL '8 hours'+((g-97001)/6)*INTERVAL '65 seconds'
          ELSE CURRENT_TIMESTAMP-INTERVAL '3 hours'+(g%120)*INTERVAL '1 minute' END AS event_at
      FROM generate_series(1,100000) g), timed AS (SELECT *, CASE WHEN status='booked' THEN NULL::timestamptz WHEN status='waiting' THEN event_at ELSE event_at-(g%80)*INTERVAL '1 minute' END AS checked_at FROM base)
      SELECT *, gen_random_uuid() AS registration_id, ($1::uuid[])[qi+1] AS queue_id,
        ($2::uuid[])[CASE WHEN status='booked' THEN 20001+(g-86001)%8000 WHEN status='waiting' THEN 1+g-94001 ELSE 1+(g*37)%40000 END] AS person_id,
        CASE WHEN status IN ('waiting','booked') THEN ($3::uuid[])[1] ELSE ($3::uuid[])[1+(g%10>=6)::int+(g%10>=9)::int] END AS tier_id,
        ($4::uuid[])[1+qi*2+(g/CASE WHEN g<=86000 THEN 540 ELSE 6 END)%2] AS session_id,($5::uuid[])[1+qi*2+(g/CASE WHEN g<=86000 THEN 540 ELSE 6 END)%2] AS operator_id,
        CASE WHEN entry_type='appointment' THEN CASE WHEN status='booked' THEN event_at ELSE checked_at+(g%10)*INTERVAL '1 minute' END END AS scheduled_at
      FROM timed`,
      [
        queues.map((q) => q.id),
        people,
        tiers.map((t) => t.tier_id),
        sessions,
        servedUsers,
      ],
    );
    await db.query(
      `INSERT INTO dorify.dori_registration(registration_id,person_id,queue_id,tier_id,business_date,ticket_number,entry_type,scheduled_time,appointment_status,checked_in_at,priority_reference_time,status,called_at,served_at,closed_at,served_by_session_id,served_by_user_id,registration_tracking_token_valid_until,language_preference,created_by_user_id,created_at,updated_at)
      SELECT registration_id,person_id,queue_id,tier_id,(event_at AT TIME ZONE 'Africa/Tunis')::date,'PF'||(qi+1)||'-'||lpad(g::text,6,'0'),entry_type,scheduled_at,
        CASE WHEN entry_type='walkin' THEN 'n/a' WHEN status='booked' THEN 'booked' WHEN status='cancelled' THEN 'cancelled' WHEN status='expired' THEN 'expired' ELSE 'checked_in' END,
        checked_at,COALESCE(GREATEST(checked_at,scheduled_at),event_at),status,
        CASE WHEN status IN ('served','no_show') THEN event_at END,
        CASE WHEN status='served' THEN event_at+(3+g%18)*INTERVAL '1 minute' END,
        CASE WHEN status IN ('served','no_show','cancelled','expired') THEN event_at+(3+g%18)*INTERVAL '1 minute' END,
        CASE WHEN status IN ('served','no_show') THEN session_id END,CASE WHEN status IN ('served','no_show') THEN operator_id END,
        CASE WHEN status IN ('waiting','booked') THEN event_at+INTERVAL '2 days' ELSE event_at+INTERVAL '1 day' END,
        CASE g%4 WHEN 0 THEN 'ar-tn' WHEN 1 THEN 'ar' WHEN 2 THEN 'en' ELSE 'fr' END,$1,
        CASE WHEN entry_type='appointment' THEN LEAST(event_at-INTERVAL '1 day',CURRENT_TIMESTAMP) ELSE checked_at-INTERVAL '1 minute' END,
        CASE WHEN status IN ('served','no_show','cancelled','expired') THEN event_at+(3+g%18)*INTERVAL '1 minute' ELSE CURRENT_TIMESTAMP END FROM pfs_rows`,
      [manager],
    );
    await db.query(
      "INSERT INTO dorify.dori_queue_daily_ticket_counter(queue_id,business_date,last_number) SELECT queue_id,(event_at AT TIME ZONE 'Africa/Tunis')::date,max(g) FROM pfs_rows GROUP BY 1,2",
    );
    await db.query(
      "INSERT INTO dorify.dori_person_note(person_id,content,created_by_user_id,created_at) SELECT person_id,'Note synthétique PERF SaaS : accueil et suivi du dossier.',$2,CURRENT_TIMESTAMP-(g%90)*INTERVAL '1 day' FROM unnest($1::uuid[]) WITH ORDINALITY p(person_id,g) WHERE g<=5000",
      [people, manager],
    );
    await db.query(
      `INSERT INTO dorify.dori_audit_event(actor_user_id,site_scope_id,action,target_type,target_id,outcome,request_method,request_path,occurred_at)
      SELECT $1,$2,'registrations.create','registration',r.registration_id::text,'success','POST','/api/v1/registrations',r.created_at FROM dorify.dori_registration r JOIN pfs_rows p USING(registration_id)`,
      [manager, site],
    );
    await db.query(
      `INSERT INTO dorify.dori_audit_event(actor_user_id,site_scope_id,action,target_type,target_id,outcome,request_method,request_path,occurred_at)
      SELECT p.operator_id,$1,'queueEngine.markServed','registration',r.registration_id::text,'success','POST','/api/v1/registrations/:registrationId/served',r.served_at FROM dorify.dori_registration r JOIN pfs_rows p USING(registration_id) WHERE r.status='served'`,
      [site],
    );
    await db.query(`INSERT INTO dorify.dori_notification(registration_id,channel,notification_type,locale,recipient,notification_content,notification_status,sent_at,delivered_at,created_at)
      SELECT registration_id,'email','welcome','fr','synthetic@example.test','Notification synthétique PERF SaaS, aucun envoi.','delivered',event_at,event_at+INTERVAL '1 minute',event_at FROM pfs_rows WHERE g<=10000`);
    const count = Number(
      (await db.query('SELECT count(*) FROM pfs_rows')).rows[0].count,
    );
    if (count !== 100000) throw new Error('Fixture count invariant failed');
    await db.query('COMMIT');
    await db.query('ANALYZE');
    const dates = (
      await db.query(
        "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Tunis')::date::text AS today",
      )
    ).rows[0];
    const fixture = {
      site,
      siteName,
      accounts,
      queues,
      tiers,
      people: people.slice(0, 1000),
      before,
      seeded: count,
      ...dates,
    };
    fs.writeFileSync(
      path.join(directory, 'fixture.json'),
      JSON.stringify(fixture),
    );
    console.log(
      JSON.stringify({
        siteName,
        seeded: count,
        existingPreserved: before,
        persons: people.length,
        queues: queues.length,
        staff: accounts.length,
      }),
    );
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
