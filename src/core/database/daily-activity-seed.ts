import { randomInt, randomUUID } from 'crypto';

export interface DailyActivitySeedConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export interface DailyActivitySeedSummary {
  queueId: string;
  queueCode: string;
  siteName: string;
  businessDate: string;
  waiting: number;
  served: number;
  noShow: number;
}

interface SeedQueueRow extends Record<string, unknown> {
  queue_id: string;
  queue_code: string;
  site_id: string;
  site_name: string;
  tier_id: string;
  business_date: string;
  day_started_at: Date;
}

const FIRST_NAMES = [
  'Amine',
  'Emma',
  'Ines',
  'Karim',
  'Lea',
  'Lucas',
  'Maya',
  'Nora',
  'Sami',
  'Yanis',
];
const LAST_NAMES = [
  'Bernard',
  'Diallo',
  'Dubois',
  'Garcia',
  'Haddad',
  'Martin',
  'Moreau',
  'Petit',
  'Robert',
  'Simon',
];

function randomItem(values: string[]): string {
  return values[randomInt(values.length)];
}

function randomDateBetween(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return new Date(endMs);
  return new Date(randomInt(startMs, endMs + 1));
}

function ticketNumber(queueCode: string, sequence: number): string {
  const trailingZeros = queueCode.match(/0+$/)?.[0];
  if (trailingZeros) {
    return `${queueCode.slice(0, -trailingZeros.length)}${String(sequence).padStart(trailingZeros.length, '0')}`;
  }
  return `${queueCode}${String(sequence).padStart(3, '0')}`;
}

function testPhoneNumber(id: string): string {
  const digits = (BigInt(`0x${id.replaceAll('-', '')}`) % 100000000000n)
    .toString()
    .padStart(11, '0');
  return `+999${digits}`;
}

export async function seedDailyActivity(
  connection: DailyActivitySeedConnection,
  now = new Date(),
): Promise<DailyActivitySeedSummary[]> {
  await connection.query('BEGIN');
  try {
    const actorResult = await connection.query<{ user_id: string }>(
      `SELECT user_id
       FROM dorify.dori_user
       WHERE username = 'root' AND is_active = TRUE
       LIMIT 1`,
    );
    const actorId = actorResult.rows[0]?.user_id;
    if (!actorId) {
      throw new Error(
        'Active root user not found. Run the reference seed first.',
      );
    }

    const queuesResult = await connection.query<SeedQueueRow>(
      `SELECT q.queue_id, q.queue_code, q.site_id, s.site_name, tier.tier_id,
              (CURRENT_TIMESTAMP AT TIME ZONE s.timezone)::date::text AS business_date,
              ((CURRENT_TIMESTAMP AT TIME ZONE s.timezone)::date::timestamp
                AT TIME ZONE s.timezone) AS day_started_at
       FROM dorify.dori_queue q
       JOIN dorify.dori_site s ON s.site_id = q.site_id
       JOIN LATERAL (
         SELECT qst.tier_id
         FROM dorify.dori_queue_service_tier qst
         JOIN dorify.dori_service_tier st ON st.tier_id = qst.tier_id
         WHERE qst.queue_id = q.queue_id
           AND qst.is_active = TRUE AND qst.deleted_at IS NULL
           AND st.is_active = TRUE AND st.deleted_at IS NULL
         ORDER BY qst.is_default DESC, qst.display_order, qst.tier_id
         LIMIT 1
       ) tier ON TRUE
       WHERE q.is_active = TRUE AND q.deleted_at IS NULL
         AND s.is_active = TRUE AND s.deleted_at IS NULL
       ORDER BY s.site_name, q.queue_code`,
    );

    const summaries: DailyActivitySeedSummary[] = [];
    for (const queue of queuesResult.rows) {
      const waiting = randomInt(3, 13);
      const served = randomInt(2, 11);
      const noShow = randomInt(1, 6);
      const total = waiting + served + noShow;
      const dayStartedAt = new Date(queue.day_started_at);
      const activityStart = new Date(
        Math.max(dayStartedAt.getTime(), now.getTime() - 8 * 60 * 60 * 1000),
      );

      const counterResult = await connection.query<{ last_number: number }>(
        `INSERT INTO dorify.dori_queue_daily_ticket_counter
           (queue_id, business_date, last_number, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (queue_id, business_date) DO UPDATE
         SET last_number = dorify.dori_queue_daily_ticket_counter.last_number + $3,
             updated_at = $4
         RETURNING last_number`,
        [queue.queue_id, queue.business_date, total, now],
      );
      const firstSequence = counterResult.rows[0].last_number - total + 1;

      const sessionResult = await connection.query<{ session_id: string }>(
        `INSERT INTO dorify.dori_operator_session
           (queue_id, user_id, thread_number, counter_name, mode,
            connected_at, last_seen_at, disconnected_at, closure_reason,
            closed_by_user_id)
         VALUES ($1, $2, NULL, $3, 'consultation_only', $4, $5, $5, 'logout', $2)
         RETURNING session_id`,
        [
          queue.queue_id,
          actorId,
          `Daily activity seed ${queue.business_date}`,
          activityStart,
          now,
        ],
      );
      const sessionId = sessionResult.rows[0].session_id;

      const statuses = [
        ...Array<string>(waiting).fill('waiting'),
        ...Array<string>(served).fill('served'),
        ...Array<string>(noShow).fill('no_show'),
      ].sort(() => Math.random() - 0.5);

      for (const [index, status] of statuses.entries()) {
        const personId = randomUUID();
        const checkedInAt = randomDateBetween(activityStart, now);
        const calledAt =
          status === 'waiting' ? null : randomDateBetween(checkedInAt, now);
        const closedAt = calledAt ? randomDateBetween(calledAt, now) : null;
        const servedAt = status === 'served' ? closedAt : null;

        await connection.query(
          `INSERT INTO dorify.dori_person
             (person_id, site_id, first_name, last_name, phone_number,
              language_preference, created_by_user_id, updated_by_user_id,
              created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'fr', $6, $6, $7, $7)`,
          [
            personId,
            queue.site_id,
            randomItem(FIRST_NAMES),
            `Seed-${randomItem(LAST_NAMES)}`,
            testPhoneNumber(personId),
            actorId,
            checkedInAt,
          ],
        );

        await connection.query(
          `INSERT INTO dorify.dori_registration
             (person_id, queue_id, tier_id, business_date, ticket_number,
              entry_type, appointment_status, checked_in_at,
              priority_reference_time, status, called_at, served_at, closed_at,
              served_by_session_id, served_by_user_id,
              registration_tracking_token_valid_until, language_preference,
              created_by_user_id, updated_by_user_id, created_at, updated_at)
           VALUES
             ($1, $2, $3, $4, $5, 'walkin', 'n/a', $6, $6, $7, $8, $9, $10,
              $11, $12, $13, 'fr', $12, $12, $6, $14)`,
          [
            personId,
            queue.queue_id,
            queue.tier_id,
            queue.business_date,
            ticketNumber(queue.queue_code, firstSequence + index),
            checkedInAt,
            status,
            calledAt,
            servedAt,
            closedAt,
            status === 'waiting' ? null : sessionId,
            status === 'waiting' ? null : actorId,
            new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            now,
          ],
        );
      }

      summaries.push({
        queueId: queue.queue_id,
        queueCode: queue.queue_code,
        siteName: queue.site_name,
        businessDate: queue.business_date,
        waiting,
        served,
        noShow,
      });
    }

    await connection.query('COMMIT');
    return summaries;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  }
}
