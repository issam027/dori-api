import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TrackingRegistrationRow {
  registration_id: string;
  registration_tracking_token_valid_until: Date | string;
  is_active: boolean;
}

@Injectable()
export class RealtimeRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findRegistrationByTrackingToken(trackingToken: string) {
    const rows = await this.dataSource.query<TrackingRegistrationRow[]>(
      `SELECT registration_id, registration_tracking_token_valid_until, is_active
       FROM dorify.dori_registration
       WHERE registration_tracking_token = $1`,
      [trackingToken],
    );
    return rows[0] ?? null;
  }

  touchQueueSession(
    sessionId: string,
    queueId: string,
    userId: string,
    lastSeenAt: Date,
  ) {
    return this.dataSource.query(
      `UPDATE dorify.dori_operator_session
       SET last_seen_at = $4
       WHERE session_id = $1 AND queue_id = $2 AND user_id = $3
         AND disconnected_at IS NULL`,
      [sessionId, queueId, userId, lastSeenAt],
    );
  }
}
