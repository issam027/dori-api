import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import {
  CreateEdgeCommandDto,
  EdgeDeploymentStatus,
  EdgeCommandResultDto,
  EdgeHeartbeatDto,
  EdgeRelayNotificationDto,
  EdgeTrackingProjectionDto,
} from './dto/edge-control.dto';
import { EdgeControlRepository } from './edge-control.repository';

type Row = Record<string, unknown>;

@Injectable()
export class EdgeControlService {
  constructor(
    private readonly repository: EdgeControlRepository,
    private readonly clock: ClockService,
  ) {}

  async authenticate(
    installationId: string,
    authorization?: string,
  ): Promise<void> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!isUUID(installationId)) throw new DoriException('UNAUTHENTICATED');
    const row = (await this.repository.findInstallation(installationId))[0] as
      Row | undefined;
    if (!token || !row || row.credential_status !== 'active') {
      throw new DoriException('UNAUTHENTICATED');
    }
    const actual = Buffer.from(this.hash(token));
    const expected = Buffer.from(String(row.token_hash));
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new DoriException('UNAUTHENTICATED');
    }
  }

  async heartbeat(
    installationId: string,
    body: EdgeHeartbeatDto,
  ): Promise<void> {
    if (body.installationId !== installationId)
      throw new DoriException('CONFLICT');
    await this.repository.updateHeartbeat(installationId, body);
  }

  async relayNotification(
    installationId: string,
    body: EdgeRelayNotificationDto,
  ) {
    await this.assertActive(installationId);
    return this.repository.relayNotification(installationId, body);
  }

  async syncTracking(
    installationId: string,
    items: EdgeTrackingProjectionDto[],
  ) {
    await this.assertActive(installationId);
    const accepted = await this.repository.syncTracking(installationId, items);
    return { accepted };
  }

  private async assertActive(installationId: string): Promise<void> {
    const row = (await this.repository.findInstallation(installationId))[0] as
      Row | undefined;
    if (!row || row.deployment_status !== EdgeDeploymentStatus.Active) {
      throw new DoriException('FORBIDDEN_PERMISSION');
    }
  }

  async agentInstallationStatus(installationId: string) {
    const row = (await this.repository.findInstallation(installationId))[0] as
      Row | undefined;
    if (!row) throw new DoriException('RESOURCE_NOT_FOUND');
    return {
      installationId,
      deploymentStatus: row.deployment_status as EdgeDeploymentStatus,
      checkedAt: this.clock.now().toISOString(),
    };
  }

  async commands(installationId: string, after: string | null) {
    const rows = await this.repository.listCommands(installationId, after);
    const commands = rows.map((row: Row) => this.agentCommand(row));
    return { commands, nextCursor: commands.at(-1)?.commandId ?? null };
  }

  async acknowledge(installationId: string, commandId: string): Promise<void> {
    await this.repository.acknowledgeCommand(installationId, commandId);
  }

  async complete(
    installationId: string,
    commandId: string,
    body: EdgeCommandResultDto,
  ): Promise<void> {
    if (body.commandId !== commandId) throw new DoriException('CONFLICT');
    await this.repository.completeCommand(
      installationId,
      commandId,
      body.status.toLowerCase(),
      body.output ?? null,
      body.error ?? null,
      body.completedAt,
    );
  }

  async createInstallation(name: string) {
    const token = `${randomUUID()}-${randomBytes(32).toString('hex')}`;
    const row = await this.repository.createInstallation(
      name,
      this.hash(token),
    );
    return { ...this.installation(row), token };
  }

  async listInstallations() {
    return (await this.repository.listInstallations()).map((row: Row) =>
      this.installation(row),
    );
  }

  async installationDetail(installationId: string) {
    const row = (await this.repository.findInstallation(installationId))[0] as
      Row | undefined;
    if (!row) throw new DoriException('RESOURCE_NOT_FOUND');
    const commands = await this.repository.listRecentCommands(installationId);
    return {
      ...this.installation(row),
      commands: commands.map((command: Row) => this.adminCommand(command)),
    };
  }

  async updateDeploymentStatus(
    installationId: string,
    deploymentStatus: EdgeDeploymentStatus,
  ) {
    const row = await this.repository.updateDeploymentStatus(
      installationId,
      deploymentStatus,
    );
    if (!row) throw new DoriException('RESOURCE_NOT_FOUND');
    return this.installation(row);
  }

  async createCommand(
    installationId: string,
    body: CreateEdgeCommandDto,
    userId: string,
  ) {
    const installation = await this.repository.findInstallation(installationId);
    if (!installation[0]) throw new DoriException('RESOURCE_NOT_FOUND');
    return this.adminCommand(
      await this.repository.createCommand(
        installationId,
        body.type,
        body.payload ?? {},
        userId,
      ),
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private installation(row: Row) {
    const lastSeen = row.last_seen_at
      ? new Date(String(row.last_seen_at))
      : null;
    const age = lastSeen
      ? this.clock.now().getTime() - lastSeen.getTime()
      : null;
    return {
      installationId: row.installation_id,
      name: row.installation_name,
      deploymentType: row.deployment_type,
      deploymentStatus: row.deployment_status as EdgeDeploymentStatus,
      status:
        age === null
          ? 'never_connected'
          : age <= 120_000
            ? 'online'
            : 'offline',
      lastSeenAt: lastSeen?.toISOString() ?? null,
      lastHeartbeat: row.last_heartbeat ?? null,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  private agentCommand(row: Row) {
    return {
      commandId: row.command_id,
      type: row.command_type,
      payload: row.payload,
      createdAt: new Date(String(row.created_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    };
  }

  private adminCommand(row: Row) {
    return {
      commandId: row.command_id,
      installationId: row.installation_id,
      type: row.command_type,
      payload: row.payload,
      status: row.command_status,
      createdAt: new Date(String(row.created_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      result: row.result ?? null,
      error: row.error_message ?? null,
    };
  }
}
