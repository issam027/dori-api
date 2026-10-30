import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EdgeCommandType } from './dto/edge-control.dto';

@Injectable()
export class EdgeControlRepository {
  constructor(private readonly database: DataSource) {}

  findInstallation(installationId: string) {
    return this.database.query(
      `SELECT installation_id, installation_name, token_hash, credential_status,
              last_seen_at, last_heartbeat, created_at
       FROM dorify.dori_edge_installation WHERE installation_id=$1`,
      [installationId],
    );
  }

  listInstallations() {
    return this.database.query(
      `SELECT installation_id, installation_name, last_seen_at, last_heartbeat, created_at
       FROM dorify.dori_edge_installation
       WHERE credential_status='active' ORDER BY installation_name`,
    );
  }

  async createInstallation(name: string, tokenHash: string) {
    const rows = await this.database.query(
      `INSERT INTO dorify.dori_edge_installation (installation_name, token_hash)
       VALUES ($1,$2)
       RETURNING installation_id, installation_name, last_seen_at, last_heartbeat, created_at`,
      [name, tokenHash],
    );
    return rows[0];
  }

  updateHeartbeat(installationId: string, heartbeat: object) {
    return this.database.query(
      `UPDATE dorify.dori_edge_installation
       SET last_seen_at=CURRENT_TIMESTAMP, last_heartbeat=$2, updated_at=CURRENT_TIMESTAMP
       WHERE installation_id=$1`,
      [installationId, heartbeat],
    );
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
