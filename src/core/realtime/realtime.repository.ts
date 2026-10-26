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

export interface RealtimeTopicStateRow extends RealtimeOutboxRow {
  version: string | number;
}

export async function enqueueRealtimeEvent(
  manager: EntityManager,
  queueId: string,
  eventType: RealtimeOutboxRow['event_type'],
  payload: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await manager.query(
    `WITH inserted AS (
       INSERT INTO dorify.dori_realtime_outbox
         (queue_id, event_type, payload, created_at, published_at)
       VALUES ($1, $2, $3::jsonb, $4, $4)
       RETURNING event_id
     )
     INSERT INTO dorify.dori_realtime_topic_state
       (queue_id, event_type, version, event_id, updated_at)
     SELECT $1, $2, 1, event_id, $4 FROM inserted
     ON CONFLICT (queue_id, event_type) DO UPDATE
     SET version = dorify.dori_realtime_topic_state.version + 1,
         event_id = EXCLUDED.event_id,
         updated_at = EXCLUDED.updated_at`,
    [queueId, eventType, JSON.stringify(payload), now],
  );
}

@Injectable()
export class RealtimeRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findTopicState(
    queueId: string,
    eventType: RealtimeOutboxRow['event_type'],
  ): Promise<RealtimeTopicStateRow | null> {
    const rows = await this.dataSource.query<RealtimeTopicStateRow[]>(
      `SELECT state.version, event.event_id, event.queue_id,
              event.event_type, event.payload
       FROM dorify.dori_realtime_topic_state state
       JOIN dorify.dori_realtime_outbox event
         ON event.event_id = state.event_id
       WHERE state.queue_id = $1 AND state.event_type = $2`,
      [queueId, eventType],
    );
    return rows[0] ?? null;
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
