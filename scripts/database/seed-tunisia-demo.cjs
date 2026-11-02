/* Explicit demo seed: never run automatically on application startup. */
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const CITIES = [
  'Tunis',
  'Sfax',
  'Sousse',
  'Nabeul',
  'Bizerte',
  'Kairouan',
  'Gabès',
  'Monastir',
  'Gafsa',
  'Médenine',
];
const FIRST = [
  'Amine',
  'Inès',
  'Youssef',
  'Mariem',
  'Aziz',
  'Nour',
  'Ahmed',
  'Sarra',
  'Mehdi',
  'Emna',
  'Walid',
  'Ons',
  'Sami',
  'Rania',
  'Firas',
  'Dorra',
  'Anis',
  'Asma',
  'Hatem',
  'Wafa',
  'خليل',
  'آمنة',
  'أيمن',
  'سلمى',
];
const LAST = [
  'Ben Ali',
  'Trabelsi',
  'Mansour',
  'Jaziri',
  'Gharbi',
  'Bouazizi',
  'Haddad',
  'Chaabane',
  'Saïdi',
  'Abid',
  'Ayari',
  'Khelifi',
  'Dridi',
  'Hamdi',
  'Rekik',
  'Ben Amor',
  'عبيدي',
  'بن صالح',
];
const QUEUES = [
  'Accueil et orientation',
  'État civil',
  'Dossiers administratifs',
  'Paiements et attestations',
  'Accompagnement social',
];
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function insert(client, table, rows) {
  if (!rows.length) return;
  if (!/^dori_[a-z_]+$/.test(table)) throw new Error('Invalid seed table');
  const columns = Object.keys(rows[0])
    .map((k) => `"${k}"`)
    .join(',');
  for (let i = 0; i < rows.length; i += 1000)
    await client.query(
      `INSERT INTO dorify.${table} (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::dorify.${table}, $1::jsonb)`,
      [JSON.stringify(rows.slice(i, i + 1000))],
    );
}
async function seedTunisiaDemo(
  client,
  {
    kind = 'cloud',
    siteCount = kind === 'intra' ? 1 : 10,
    seed = 20261102,
    historyDays = 90,
    log = console.log,
  } = {},
) {
  if (
    !['cloud', 'intra'].includes(kind) ||
    siteCount < 1 ||
    siteCount > 10 ||
    (kind === 'intra' && siteCount !== 1) ||
    historyDays < 30 ||
    historyDays > 365
  )
    throw new Error('Invalid demo scope');
  const rng = random(seed),
    pick = (values) => values[Math.floor(rng() * values.length)],
    integer = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const now = new Date(
    (await client.query('SELECT CURRENT_TIMESTAMP AS now')).rows[0].now,
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const dayAt = (offset) =>
    new Date(Date.parse(`${today}T12:00:00+01:00`) + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const at = (day, minutes) =>
    new Date(
      Date.parse(`${day}T00:00:00+01:00`) + minutes * 60000,
    ).toISOString();
  const root = (
    await client.query(
      "SELECT user_id FROM dorify.dori_user WHERE username='root'",
    )
  ).rows[0]?.user_id;
  if (!root) throw new Error('Reference seed must be installed first');
  if (
    Number(
      (await client.query('SELECT count(*) FROM dorify.dori_site')).rows[0]
        .count,
    )
  )
    throw new Error('Demo seed requires an empty site portfolio');
  const roles = Object.fromEntries(
    (
      await client.query('SELECT role_name,role_id FROM dorify.dori_role')
    ).rows.map((r) => [r.role_name, r.role_id]),
  );
  const tiers = (
    await client.query(
      "SELECT tier_id,tier_code FROM dorify.dori_service_tier ORDER BY CASE tier_code WHEN 'free' THEN 0 WHEN 'standard' THEN 1 ELSE 2 END",
    )
  ).rows;
  if (tiers.length !== 3)
    throw new Error('Expected the three reference service tiers');
  const passwordHash = await bcrypt.hash('DemoTn@2026!', 12);
  const totals = {
    sites: siteCount,
    queues: 0,
    persons: 0,
    registrations: 0,
    seed,
    historyDays,
    businessDate: today,
  };
  await client.query('BEGIN');
  try {
    for (let s = 0; s < siteCount; s++) {
      const city = kind === 'intra' ? 'Ariana' : CITIES[s],
        siteId = randomUUID(),
        prefix = `tn_${kind}${String(s + 1).padStart(2, '0')}`;
      const users = [],
        memberships = [],
        userRoles = [],
        queueAssignments = [];
      function user(suffix, role, type = 'human') {
        const id = randomUUID();
        users.push({
          user_id: id,
          username: `${prefix}_${suffix}`,
          full_name: `${pick(FIRST)} ${pick(LAST)}`,
          email: `${prefix}_${suffix}@example.test`,
          password_hash: passwordHash,
          user_type: type,
          language_preference: pick(['fr', 'ar', 'ar-TN']),
          must_change_password: false,
        });
        memberships.push({
          user_id: id,
          site_id: siteId,
          assigned_by_user_id: root,
        });
        userRoles.push({
          user_id: id,
          role_id: roles[role],
          assigned_by_user_id: root,
        });
        return id;
      }
      const manager = user('manager', 'manager');
      user('kiosk', 'kiosk', 'kiosk');
      const queues = QUEUES.map((name, q) => ({
        queue_id: randomUUID(),
        site_id: siteId,
        queue_code: `${kind === 'intra' ? 'A' : 'T'}${s + 1}${q + 1}`,
        queue_name: name,
        thread_count: integer(1, 3),
        average_wait_time: integer(5, 25),
        appointments_enabled: q !== 0,
        locale: null,
        currency: null,
        created_by_user_id: manager,
      }));
      const operators = queues.map((q, qi) =>
        Array.from({ length: q.thread_count }, (_, t) => {
          const id = user(`q${qi + 1}_op${t + 1}`, 'operator');
          queueAssignments.push({
            user_id: id,
            queue_id: q.queue_id,
            assigned_by_user_id: manager,
          });
          return id;
        }),
      );
      await insert(client, 'dori_user', users);
      await insert(client, 'dori_site', [
        {
          site_id: siteId,
          site_name: `Maison des services de ${city}`,
          site_location: `Avenue ${pick(['Habib Bourguiba', 'de la République', 'Farhat Hached', 'de Carthage'])}, ${city}, Tunisie`,
          site_type: s % 3 ? 'public' : 'private',
          timezone: 'Africa/Tunis',
          default_currency: 'TND',
          default_locale: pick(['fr', 'ar', 'ar-TN']),
          default_appointments_enabled: true,
          default_appointment_slot_duration: 15,
          default_slot_capacity: 2,
          default_working_days: [1, 2, 3, 4, 5, 6],
          default_working_hours_start: '08:00',
          default_working_hours_end: '18:00',
          default_break_start: '12:30',
          default_break_end: '13:30',
          created_by_user_id: root,
        },
      ]);
      await insert(client, 'dori_user_role', userRoles);
      await insert(client, 'dori_user_site_assignment', memberships);
      await insert(client, 'dori_queue', queues);
      await insert(client, 'dori_user_queue_assignment', queueAssignments);
      const associations = queues.flatMap((q, qi) =>
        tiers.map((tier, ti) => ({
          queue_id: q.queue_id,
          tier_id: tier.tier_id,
          display_order: ti,
          price: ti ? ti * 5 + (s % 4) : 0,
          currency: 'TND',
          is_active: qi !== 0 || ti === 0,
          is_default: qi % 3 === 1 && ti === 0,
        })),
      );
      await insert(client, 'dori_queue_service_tier', associations);
      await insert(
        client,
        'dori_queue_tier_notification_rule',
        associations
          .filter((a) => a.is_active && a.tier_id !== tiers[0].tier_id)
          .flatMap((a) => [
            {
              queue_id: a.queue_id,
              tier_id: a.tier_id,
              notification_type: 'threshold',
              channel: 'sms',
              threshold_position: 3,
              include_tracking_link: true,
            },
            ...(a.tier_id === tiers[2].tier_id
              ? [
                  {
                    queue_id: a.queue_id,
                    tier_id: a.tier_id,
                    notification_type: 'welcome',
                    channel: 'sms',
                    threshold_position: null,
                    include_tracking_link: true,
                  },
                ]
              : []),
          ]),
      );
      const persons = Array.from({ length: 2500 }, (_, p) => ({
        person_id: randomUUID(),
        site_id: siteId,
        first_name: pick(FIRST),
        last_name: pick(LAST),
        email: p % 4 ? `client.${prefix}.${p}@example.test` : null,
        phone_number: `+216${pick(['2', '5', '9'])}${String((s + 1) * 100000 + p).padStart(7, '0')}`,
        birth_date: `${integer(1940, 2007)}-${String(integer(1, 12)).padStart(2, '0')}-${String(integer(1, 28)).padStart(2, '0')}`,
        language_preference: pick([
          'ar-TN',
          'ar-TN',
          'ar-TN',
          'ar',
          'fr',
          'fr',
          'en',
        ]),
        created_by_user_id: manager,
      }));
      await insert(client, 'dori_person', persons);
      await insert(
        client,
        'dori_person_note',
        persons
          .filter((_, p) => p % 9 === 0)
          .map((p) => ({
            person_id: p.person_id,
            content: pick([
              'Préfère un rendez-vous en matinée.',
              'Dossier à compléter lors de la prochaine visite.',
              'يحب يجي بكري، قبل العشرة.',
              'Accompagnement demandé pour les démarches numériques.',
              'تمّ التثبت من الوثائق المطلوبة.',
            ]),
            created_by_user_id: manager,
          })),
      );
      const openPersons = queues.map(() => new Set());
      const siteSessions = [],
        siteRegistrations = [],
        siteNotifications = [],
        siteAudits = [];
      for (let offset = -historyDays; offset <= 21; offset++) {
        const day = dayAt(offset),
          weekday = new Date(`${day}T12:00Z`).getUTCDay();
        if (weekday === 0 && offset !== 0) continue;
        for (let qi = 0; qi < queues.length; qi++) {
          const q = queues[qi],
            future = offset > 0;
          if (future && !q.appointments_enabled) continue;
          const sessions = operators[qi].map((id, t) => ({
            session_id: randomUUID(),
            queue_id: q.queue_id,
            user_id: id,
            thread_number: t + 1,
            counter_name: `Guichet ${t + 1}`,
            connected_at:
              offset === 0
                ? new Date(now.getTime() - 4 * 3600000).toISOString()
                : at(day, 475),
            last_seen_at: offset === 0 ? now.toISOString() : at(day, 1080),
            disconnected_at: offset === 0 ? null : at(day, 1080),
            closure_reason: offset === 0 ? null : 'logout',
          }));
          if (!future) siteSessions.push(...sessions);
          const next = sessions.map(() => 480),
            regs = [],
            notifications = [];
          const count = future
            ? integer(6, 12)
            : offset === 0
              ? integer(8, 24)
              : Math.min(
                  integer(35, 85),
                  q.thread_count * Math.floor(420 / (6 + qi * 1.5)),
                ) * (weekday === 6 ? 0.6 : weekday === 1 ? 1.3 : 1);
          for (let i = 0; i < Math.floor(count); i++) {
            const open = future || offset === 0,
              candidates = persons.filter(
                (p) => !open || !openPersons[qi].has(p.person_id),
              );
            const p = pick(candidates);
            if (!p)
              throw new Error('Insufficient unique customers for open tickets');
            if (open) openPersons[qi].add(p.person_id);
            const appointment =
              future || (q.appointments_enabled && rng() < 0.4);
            let arrival = 480 + Math.floor((i * 480) / count) + integer(0, 4);
            if (future) {
              arrival = 480 + i * 30;
              if (arrival >= 750) arrival += 60;
            }
            const start = future
              ? at(day, arrival)
              : offset === 0
                ? new Date(now.getTime() - integer(1, 70) * 60000).toISOString()
                : at(day, arrival);
            const r = rng(),
              status = future
                ? 'booked'
                : offset === 0
                  ? 'waiting'
                  : r < 0.8
                    ? 'served'
                    : r < 0.88
                      ? 'no_show'
                      : r < 0.95
                        ? 'cancelled'
                        : 'expired';
            const served = ['served', 'no_show'].includes(status),
              thread = next.indexOf(Math.min(...next));
            const called = Math.max(
              arrival + integer(2, 12 + qi * 7 + (weekday === 1 ? 20 : 0)),
              next[thread],
            );
            const finish =
              called +
              (status === 'no_show' ? integer(1, 4) : integer(3, 8 + qi * 3));
            next[thread] = finish;
            const tierIndex = qi === 0 ? 0 : pick([0, 0, 0, 1, 1, 2]),
              id = randomUUID(),
              token = randomUUID();
            const paid = tierIndex > 0 && rng() > 0.15;
            regs.push({
              registration_id: id,
              person_id: p.person_id,
              queue_id: q.queue_id,
              tier_id: tiers[tierIndex].tier_id,
              business_date: day,
              ticket_number: `${q.queue_code}${String(i + 1).padStart(5, '0')}`,
              entry_type: appointment ? 'appointment' : 'walkin',
              scheduled_time: appointment ? start : null,
              appointment_status: appointment
                ? future
                  ? 'booked'
                  : status === 'cancelled' || status === 'expired'
                    ? status
                    : 'checked_in'
                : 'n/a',
              checked_in_at: future ? null : start,
              priority_reference_time: start,
              status,
              called_at: served ? at(day, called) : null,
              served_at: status === 'served' ? at(day, finish) : null,
              closed_at:
                offset < 0
                  ? at(day, served ? finish : arrival + integer(10, 60))
                  : null,
              served_by_session_id: served ? sessions[thread].session_id : null,
              served_by_user_id: served ? sessions[thread].user_id : null,
              registration_tracking_token: token,
              registration_tracking_token_valid_until: at(
                dayAt(offset + 2),
                1439,
              ),
              payment_status: tierIndex
                ? paid
                  ? 'paid'
                  : 'pending'
                : 'not_applicable',
              payment_amount: tierIndex ? tierIndex * 5 + (s % 4) : 0,
              payment_currency: 'TND',
              payment_method: paid
                ? pick(['cash', 'card', 'kiosk_card'])
                : null,
              paid_at: paid ? (future ? now.toISOString() : start) : null,
              language_preference: p.language_preference,
              created_at: future ? now.toISOString() : start,
              updated_at:
                offset < 0 ? at(day, served ? finish : arrival + 60) : start,
              created_by_user_id: manager,
            });
            if (offset < 0 && tierIndex && rng() < 0.5) {
              const delivered = rng() < 0.95;
              notifications.push({
                registration_id: id,
                channel: 'sms',
                notification_type: 'welcome',
                locale: p.language_preference,
                recipient: p.phone_number,
                notification_content: `Bienvenue à ${city}. Votre ticket : ${regs.at(-1).ticket_number}.`,
                notification_status: delivered ? 'delivered' : 'failed',
                failure_reason: delivered
                  ? null
                  : 'Simulation de démonstration',
                sent_at: delivered
                  ? new Date(Date.parse(start) + 2000).toISOString()
                  : null,
                delivered_at: delivered
                  ? new Date(Date.parse(start) + 10000).toISOString()
                  : null,
                provider: 'simulation',
                created_at: start,
              });
            }
          }
          siteRegistrations.push(...regs);
          siteNotifications.push(...notifications);
          siteAudits.push(
            ...regs
              .filter((_, index) => index % 12 === 0)
              .map((r) => ({
                actor_user_id: manager,
                site_scope_id: siteId,
                action: 'registrations.register',
                target_type: 'registration',
                target_id: r.registration_id,
                outcome: 'success',
                request_method: 'POST',
                request_path: '/api/v1/registrations',
                occurred_at: r.created_at,
              })),
          );
        }
      }
      await insert(client, 'dori_operator_session', siteSessions);
      await insert(client, 'dori_registration', siteRegistrations);
      await insert(client, 'dori_notification', siteNotifications);
      await insert(client, 'dori_audit_event', siteAudits);
      totals.queues += queues.length;
      totals.persons += persons.length;
      log(`Données tunisiennes : ${city} préparé`);
    }
    await client.query(
      `INSERT INTO dorify.dori_queue_daily_ticket_counter(queue_id,business_date,last_number) SELECT queue_id,business_date,count(*)::integer FROM dorify.dori_registration GROUP BY queue_id,business_date`,
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  totals.registrations = Number(
    (await client.query('SELECT count(*) FROM dorify.dori_registration'))
      .rows[0].count,
  );
  await client.query('ANALYZE');
  await client.query('SELECT dorify_agent.refresh_tracking()');
  return totals;
}
module.exports = { seedTunisiaDemo, random, insert };
