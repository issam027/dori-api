import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EdgeCommandType } from './dto/edge-control.dto';
import {
  EdgeRelayNotificationDto,
  EdgeTrackingProjectionDto,
} from './dto/edge-control.dto';

@Injectable()
export class EdgeControlRepository {
  constructor(private readonly database: DataSource) {}

  findInstallation(installationId: string) {
    return this.database.query(
      `SELECT installation_id, installation_name, token_hash, credential_status,
              deployment_type, deployment_status,
              last_seen_at, last_heartbeat, created_at
       FROM dorify.dori_edge_installation WHERE installation_id=$1`,
      [installationId],
    );
  }

  listInstallations() {
    return this.database.query(
      `SELECT installation_id, installation_name, deployment_type, deployment_status,
              last_seen_at, last_heartbeat, created_at
       FROM dorify.dori_edge_installation
       WHERE credential_status='active' ORDER BY installation_name`,
    );
  }

  async installationRoomSignature(): Promise<string> {
    const rows = await this.database.query<{ signature: string }[]>(
      `SELECT md5(
         COALESCE((
           SELECT string_agg(
             installation_id::text || ':' || deployment_status || ':' ||
             CASE WHEN last_seen_at IS NULL THEN 'never_connected'
                  WHEN last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '2 minutes' THEN 'online'
                  ELSE 'offline' END || ':' || updated_at::text,
             '|' ORDER BY installation_id)
           FROM dorify.dori_edge_installation WHERE credential_status='active'
         ), '') || '#' || COALESCE((
           SELECT string_agg(
             command_id::text || ':' || command_status || ':' ||
             COALESCE(completed_at, acknowledged_at, created_at)::text,
             '|' ORDER BY command_id)
           FROM dorify.dori_edge_command
         ), '')
       ) AS signature`,
    );
    return rows[0]?.signature ?? '';
  }

  async createInstallation(name: string, tokenHash: string) {
    const rows = await this.database.query(
      `INSERT INTO dorify.dori_edge_installation (installation_name, token_hash)
       VALUES ($1,$2)
       RETURNING installation_id, installation_name, deployment_type, deployment_status,
                 last_seen_at, last_heartbeat, created_at`,
      [name, tokenHash],
    );
    return rows[0];
  }

  async updateDeploymentStatus(
    installationId: string,
    deploymentStatus: string,
  ) {
    const rows = await this.database.query(
      `UPDATE dorify.dori_edge_installation
       SET deployment_status=$2, updated_at=CURRENT_TIMESTAMP
       WHERE installation_id=$1
       RETURNING installation_id, installation_name, deployment_type, deployment_status,
                 last_seen_at, last_heartbeat, created_at`,
      [installationId, deploymentStatus],
    );
    return rows[0] as Record<string, unknown> | undefined;
  }

  updateHeartbeat(installationId: string, heartbeat: object) {
    return this.database.query(
      `UPDATE dorify.dori_edge_installation
       SET last_seen_at=CURRENT_TIMESTAMP, last_heartbeat=$2, updated_at=CURRENT_TIMESTAMP
       WHERE installation_id=$1`,
      [installationId, heartbeat],
    );
  }

  async relayNotification(
    installationId: string,
    body: EdgeRelayNotificationDto,
  ) {
    const rows = await this.database.query(
      `INSERT INTO dorify.dori_notification
       (notification_id, registration_id, source_installation_id, source_registration_id,
        channel, notification_type, locale, recipient, notification_content,
        notification_status, dispatch_route, attempt_count, created_at, updated_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'pending', 'direct', 0, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (notification_id) DO UPDATE SET notification_id=EXCLUDED.notification_id
       RETURNING notification_id, notification_status`,
      [
        body.notificationId,
        installationId,
        body.registrationId,
        body.channel,
        body.notificationType,
        body.locale,
        body.recipient,
        body.content,
        body.createdAt,
      ],
    );
    return {
      accepted: true,
      notificationId: rows[0].notification_id,
      status: rows[0].notification_status,
    };
  }

  async syncTracking(
    installationId: string,
    items: EdgeTrackingProjectionDto[],
  ): Promise<number> {
    if (!items.length) return 0;
    const rows = await this.database.query(
      `INSERT INTO dorify.dori_public_tracking_state
       (tracking_token_hash, registration_id, source_installation_id, source_registration_id,
        sequence, cloud_synced_sequence, ticket_number, registration_status, position,
        estimated_wait_minutes, counter_name, queue_public_name, observed_at, expires_at, updated_at)
       SELECT x.token_hash, NULL, $2, x.registration_id, x.sequence, x.sequence,
              x.ticket_number, x.registration_status, x.position, x.estimated_wait_minutes,
              x.counter_name, x.queue_name, x.observed_at, x.expires_at, CURRENT_TIMESTAMP
       FROM jsonb_to_recordset($1::jsonb) AS x(
         token_hash char(64), registration_id uuid, sequence bigint, ticket_number varchar,
         registration_status varchar, position int, estimated_wait_minutes int,
         counter_name varchar, queue_name varchar, observed_at timestamptz, expires_at timestamptz)
       ON CONFLICT (tracking_token_hash) DO UPDATE SET
         source_installation_id=EXCLUDED.source_installation_id,
         source_registration_id=EXCLUDED.source_registration_id,
         sequence=EXCLUDED.sequence, cloud_synced_sequence=EXCLUDED.sequence,
         ticket_number=EXCLUDED.ticket_number, registration_status=EXCLUDED.registration_status,
         position=EXCLUDED.position, estimated_wait_minutes=EXCLUDED.estimated_wait_minutes,
         counter_name=EXCLUDED.counter_name, queue_public_name=EXCLUDED.queue_public_name,
         observed_at=EXCLUDED.observed_at, expires_at=EXCLUDED.expires_at, updated_at=CURRENT_TIMESTAMP
       WHERE EXCLUDED.sequence > dorify.dori_public_tracking_state.sequence
       RETURNING tracking_token_hash`,
      [
        JSON.stringify(
          items.map((item) => ({
            token_hash: item.tokenHash,
            registration_id: item.registrationId,
            sequence: item.sequence,
            ticket_number: item.ticketNumber,
            registration_status: item.registrationStatus,
            position: item.position ?? null,
            estimated_wait_minutes: item.estimatedWaitMinutes ?? null,
            counter_name: item.counterName ?? null,
            queue_name: item.queueName,
            observed_at: item.observedAt,
            expires_at: item.expiresAt,
          })),
        ),
        installationId,
      ],
    );
    return rows.length;
  }

  listCommands(installationId: string, after: string | null) {
    return this.database.query(
      `SELECT command_id, installation_id, command_type, payload, command_status,
              result, error_message, created_at, expires_at
       FROM dorify.dori_edge_command
       WHERE installation_id=$1
         AND ($2::uuid IS NULL OR (created_at, command_id) > (
           SELECT created_at, command_id FROM dorify.dori_edge_command WHERE command_id=$2
         ))
       ORDER BY created_at, command_id LIMIT 100`,
      [installationId, after],
    );
  }

  listRecentCommands(installationId: string) {
    return this.database.query(
      `SELECT command_id, installation_id, command_type, payload, command_status,
              result, error_message, created_at, expires_at
       FROM dorify.dori_edge_command WHERE installation_id=$1
       ORDER BY created_at DESC LIMIT 50`,
      [installationId],
    );
  }

  async createCommand(
    installationId: string,
    type: EdgeCommandType,
    payload: object,
    userId: string,
  ) {
    const rows = await this.database.query(
      `INSERT INTO dorify.dori_edge_command
       (installation_id, command_type, payload, created_by_user_id, expires_at)
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       RETURNING command_id, installation_id, command_type, payload, command_status,
                 result, error_message, created_at, expires_at`,
      [installationId, type, payload, userId],
    );
    return rows[0];
  }

  acknowledgeCommand(installationId: string, commandId: string) {
    return this.database.query(
      `UPDATE dorify.dori_edge_command
       SET command_status=CASE WHEN command_status='pending' THEN 'acknowledged' ELSE command_status END,
           acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP)
       WHERE installation_id=$1 AND command_id=$2`,
      [installationId, commandId],
    );
  }

  completeCommand(
    installationId: string,
    commandId: string,
    status: string,
    result: object | null,
    error: string | null,
    completedAt: string,
  ) {
    return this.database.query(
      `UPDATE dorify.dori_edge_command
       SET command_status=$3, result=$4, error_message=$5, completed_at=$6
       WHERE installation_id=$1 AND command_id=$2
         AND command_status IN ('pending','acknowledged')`,
      [installationId, commandId, status, result, error, completedAt],
    );
  }
}
