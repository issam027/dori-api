import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class JwtSessionRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findValidSessionId(sessionId: string, userId: number, now: Date) {
    const rows = await this.dataSource.query<Array<{ session_id: string }>>(
      `SELECT s.session_id
       FROM dori_user_session s
       JOIN dori_user u ON u.user_id = s.user_id
       WHERE s.session_id = $1 AND s.user_id = $2
         AND s.revoked_reason IS NULL AND s.revoked_at IS NULL
         AND s.expires_at > $3
         AND u.is_active = TRUE AND u.deleted_at IS NULL`,
      [sessionId, userId, now],
    );
    return rows[0]?.session_id ?? null;
  }
}
