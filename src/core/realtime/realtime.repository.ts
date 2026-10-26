import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export interface TrackingRegistrationRow {
  queue_id: string;
  registration_tracking_token_valid_until: Date | string;
  is_active: boolean;
}

export interface RealtimeOutboxRow {
  event_id: string;
  queue_id: string;
  event_type: 'queue_display_changed' | 'queue_position_changed';
  payload: Record<string, unknown>;
}

export async function enqueueRealtimeEvent(
  manager: EntityManager,
  queueId: string,
  eventType: RealtimeOutboxRow['event_type'],
  payload: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await manager.query(
    `INSERT INTO dorify.dori_realtime_outbox
       (queue_id, event_type, payload, created_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [queueId, eventType, JSON.stringify(payload), now],
  );
}

@Injectable()
export class RealtimeRepository {
  constructor(private readonly dataSource: DataSource) {}

  claimPending(now: Date, limit = 100): Promise<RealtimeOutboxRow[]> {
    return this.dataSource.transaction((manager) =>
      manager.query(
        `WITH candidates AS (
           SELECT event_id
           FROM dorify.dori_realtime_outbox
           WHERE published_at IS NULL
             AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
             AND (processing_started_at IS NULL OR processing_started_at < $1 - INTERVAL '5 minutes')
           ORDER BY created_at, event_id
           FOR UPDATE SKIP LOCKED
           LIMIT $2
         )
         UPDATE dorify.dori_realtime_outbox outbox
         SET processing_started_at = $1
         FROM candidates
         WHERE outbox.event_id = candidates.event_id
         RETURNING outbox.event_id, outbox.queue_id, outbox.event_type, outbox.payload`,
        [now, limit],
      ),
    );
  }

  async markPublished(eventId: string, now: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE dorify.dori_realtime_outbox
       SET published_at = $1, attempt_count = attempt_count + 1,
           processing_started_at = NULL, next_attempt_at = NULL
       WHERE event_id = $2 AND published_at IS NULL`,
      [now, eventId],
    );
  }

  async markFailed(eventId: string, now: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE dorify.dori_realtime_outbox
       SET attempt_count = attempt_count + 1, last_error_at = $1,
           processing_started_at = NULL,
           next_attempt_at = $1 + LEAST(INTERVAL '5 minutes',
             INTERVAL '5 seconds' * POWER(2, LEAST(attempt_count, 6)))
       WHERE event_id = $2 AND published_at IS NULL`,
      [now, eventId],
    );
  }

  async deletePublishedBefore(cutoff: Date): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM dorify.dori_realtime_outbox
       WHERE published_at IS NOT NULL AND published_at < $1`,
      [cutoff],
    );
  }

  findReplay(
    eventId: string,
    queueId: string,
    eventType: RealtimeOutboxRow['event_type'],
  ): Promise<RealtimeOutboxRow[]> {
    return this.dataSource.query(
      `SELECT candidate.event_id, candidate.queue_id, candidate.event_type,
              candidate.payload
       FROM dorify.dori_realtime_outbox anchor
       JOIN dorify.dori_realtime_outbox candidate
         ON (candidate.created_at, candidate.event_id) > (anchor.created_at, anchor.event_id)
       WHERE anchor.event_id = $1 AND candidate.queue_id = $2
         AND candidate.event_type = $3 AND candidate.published_at IS NOT NULL
       ORDER BY candidate.created_at, candidate.event_id LIMIT 100`,
      [eventId, queueId, eventType],
    );
  }

  async findRegistrationByTrackingToken(trackingToken: string) {
    const rows = await this.dataSource.query<TrackingRegistrationRow[]>(
      `SELECT queue_id, registration_tracking_token_valid_until, is_active
       FROM dorify.dori_registration
       WHERE registration_tracking_token = $1`,
      [trackingToken],
    );
    return rows[0] ?? null;
  }
}
