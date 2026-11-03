import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export interface TrackingRegistrationRow {
  queue_id: string;
  registration_tracking_token_valid_until: Date | string;
  is_active: boolean;
}

export interface ReplicatedTrackingRow {
  source_installation_id?: string;
  source_last_seen_at?: Date | string | null;
  sequence: string | number;
  expires_at: Date | string;
  observed_at: Date | string;
  deployment_status: string;
  source_connectivity: 'online' | 'offline';
  ticket_number: string | null;
  registration_status: string;
  position: number | null;
  estimated_wait_minutes: number | null;
  counter_name: string | null;
  queue_public_name: string | null;
  language_preference?: string | null;
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

  async findReplicatedTracking(
    hash: string,
  ): Promise<ReplicatedTrackingRow | null> {
    const rows = await this.dataSource.query<ReplicatedTrackingRow[]>(
      `SELECT t.source_installation_id, e.last_seen_at AS source_last_seen_at,
              t.sequence, t.expires_at, t.observed_at, t.ticket_number,
              t.registration_status, t.position, t.estimated_wait_minutes,
              t.counter_name, t.queue_public_name, t.language_preference, e.deployment_status,
              CASE WHEN e.last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '2 minutes'
                   THEN 'online' ELSE 'offline' END AS source_connectivity
       FROM dorify.dori_public_tracking_state t
       JOIN dorify.dori_edge_installation e ON e.installation_id=t.source_installation_id
       WHERE t.tracking_token_hash=$1`,
      [hash],
    );
    return rows[0] ?? null;
  }

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
