import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EdgeCommandType {
  RunHealthCheck = 'RUN_HEALTH_CHECK',
  SyncNow = 'SYNC_NOW',
}

export enum EdgeCommandResultStatus {
  Succeeded = 'SUCCEEDED',
  Failed = 'FAILED',
  Expired = 'EXPIRED',
}

export enum EdgeDeploymentStatus {
  Active = 'active',
  Revoked = 'revoked',
}

class EdgeVersionsDto {
  @IsString() @IsNotEmpty() engine!: string;
  @IsString() @IsNotEmpty() app!: string;
  @IsString() @IsNotEmpty() agent!: string;
}

class EdgeHealthDto {
  @IsIn(['up']) agent!: 'up';
  @IsIn(['ok', 'degraded', 'unreachable'])
  engine!: 'ok' | 'degraded' | 'unreachable';
}

export class EdgeHeartbeatDto {
  @IsUUID() installationId!: string;
  @IsDateString() sentAt!: string;
  @ValidateNested() @Type(() => EdgeVersionsDto) versions!: EdgeVersionsDto;
  @ValidateNested() @Type(() => EdgeHealthDto) health!: EdgeHealthDto;
}

export class EdgeRelayNotificationDto {
  @IsUUID() notificationId!: string;
  @IsUUID() registrationId!: string;
  @IsIn(['sms', 'email']) channel!: 'sms' | 'email';
  @IsIn(['welcome', 'threshold']) notificationType!: 'welcome' | 'threshold';
  @IsString() @MaxLength(10) locale!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) recipient!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsDateString() createdAt!: string;
}

export class EdgeTrackingProjectionDto {
  @Matches(/^[0-9a-f]{64}$/i) tokenHash!: string;
  @IsUUID() registrationId!: string;
  @IsInt() @Min(1) sequence!: number;
  @IsString() @MaxLength(14) ticketNumber!: string;
  @IsIn([
    'booked',
    'waiting',
    'in_progress',
    'served',
    'no_show',
    'cancelled',
    'expired',
  ])
  registrationStatus!: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsInt() @Min(0) estimatedWaitMinutes?: number;
  @IsOptional() @IsString() @MaxLength(100) counterName?: string;
  @IsString() @MaxLength(200) queueName!: string;
  @IsDateString() observedAt!: string;
  @IsDateString() expiresAt!: string;
}

export class EdgeTrackingBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeTrackingProjectionDto)
  items!: EdgeTrackingProjectionDto[];
}

export class EdgeCommandResultDto {
  @IsUUID() commandId!: string;
  @IsEnum(EdgeCommandResultStatus) status!: EdgeCommandResultStatus;
  @IsDateString() completedAt!: string;
  @IsOptional() @IsObject() output?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) error?: string;
}

export class EdgeCommandCursorQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Opaque cursor returned previously',
  })
  @IsOptional()
  @IsUUID()
  after?: string;
}

export class CreateEdgeInstallationDto {
  @ApiProperty({ example: 'Agence Tunis Centre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

export class UpdateEdgeInstallationStatusDto {
  @ApiProperty({ enum: EdgeDeploymentStatus })
  @IsEnum(EdgeDeploymentStatus)
  deploymentStatus!: EdgeDeploymentStatus;
}

export class CreateEdgeCommandDto {
  @ApiProperty({ enum: EdgeCommandType })
  @IsEnum(EdgeCommandType)
  type!: EdgeCommandType;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class EdgeInstallationResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Stable installation identifier required as DORIFY_INSTALLATION_ID by the intra agent.',
  })
  installationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['intra'] }) deploymentType!: 'intra';
  @ApiProperty({ enum: EdgeDeploymentStatus })
  deploymentStatus!: EdgeDeploymentStatus;
  @ApiProperty({ enum: ['online', 'offline', 'never_connected'] })
  status!: string;
  @ApiProperty({ nullable: true, format: 'date-time' }) lastSeenAt!:
    string | null;
  @ApiPropertyOptional({ type: Object }) lastHeartbeat?: Record<
    string,
    unknown
  > | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class EdgeAgentInstallationStatusResponseDto {
  @ApiProperty({ format: 'uuid' }) installationId!: string;
  @ApiProperty({ enum: EdgeDeploymentStatus })
  deploymentStatus!: EdgeDeploymentStatus;
  @ApiProperty({ format: 'date-time' }) checkedAt!: string;
}

export class EdgeLocalStatusResponseDto {
  @ApiProperty() configured!: boolean;
  @ApiProperty({ enum: ['active', 'revoked', 'unknown'] })
  deploymentStatus!: 'active' | 'revoked' | 'unknown';
  @ApiProperty({ enum: ['connected', 'unreachable', 'not_configured'] })
  cloudReachability!: 'connected' | 'unreachable' | 'not_configured';
  @ApiPropertyOptional({ nullable: true, format: 'date-time', type: String })
  lastCloudSuccessAt!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  lastCloudError!: string | null;
}

export class EdgeInstallationCredentialResponseDto extends EdgeInstallationResponseDto {
  @ApiProperty({
    description:
      'One-time installation credential required as DORIFY_CLOUD_TOKEN by the intra agent. It cannot be retrieved again.',
  })
  token!: string;
}

export class EdgeCommandResponseDto {
  @ApiProperty({ format: 'uuid' }) commandId!: string;
  @ApiProperty({ format: 'uuid' }) installationId!: string;
  @ApiProperty({ enum: EdgeCommandType }) type!: EdgeCommandType;
  @ApiProperty({ type: Object }) payload!: Record<string, unknown>;
  @ApiProperty() status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiPropertyOptional({ type: Object }) result?: Record<
    string,
    unknown
  > | null;
  @ApiPropertyOptional() error?: string | null;
}

export class EdgeInstallationDetailResponseDto extends EdgeInstallationResponseDto {
  @ApiProperty({ type: [EdgeCommandResponseDto] })
  commands!: EdgeCommandResponseDto[];
}

export class EdgeCommandPageResponseDto {
  @ApiProperty({ type: [EdgeCommandResponseDto] })
  commands!: EdgeCommandResponseDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
}
