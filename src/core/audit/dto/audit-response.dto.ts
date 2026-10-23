import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../pagination/pagination.dto';

export class AuditEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiPropertyOptional({ nullable: true })
  actorUserId: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Sophie Martin (smartin)' })
  actorDisplayName: string | null;

  @ApiProperty({ example: 'queue.reset' })
  action: string;

  @ApiProperty({ example: 'queue' })
  targetType: string;

  @ApiPropertyOptional({ nullable: true, example: '8' })
  targetId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Accueil principal' })
  targetDisplayName: string | null;

  @ApiPropertyOptional({ nullable: true, example: '12' })
  secondaryTargetId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Opérateur Jean (jdupont)' })
  secondaryTargetDisplayName: string | null;

  @ApiPropertyOptional({ nullable: true, example: 3 })
  siteScopeId: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Agence Centre' })
  siteScopeDisplayName: string | null;

  @ApiProperty({ enum: ['success', 'failure'] })
  outcome: 'success' | 'failure';

  @ApiPropertyOptional({ nullable: true, type: String })
  correlationId: string | null;

  @ApiProperty({ example: 'POST' })
  requestMethod: string;

  @ApiProperty({ example: 'queues/:queueId/reset' })
  requestPath: string;

  @ApiPropertyOptional({ nullable: true, example: 'DoriException' })
  failureType: string | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;
}

export class AuditEventDetailResponseDto extends AuditEventResponseDto {
  @ApiPropertyOptional({ nullable: true, example: 'smartin' })
  actorUsername: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Sophie Martin' })
  actorFullName: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ['human', 'kiosk'] })
  actorUserType: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorIsActive: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  targetIsActive: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  secondaryTargetIsActive: boolean | null;

  @ApiPropertyOptional({ nullable: true, example: '12 avenue Centrale' })
  siteScopeLocation: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Europe/Paris' })
  siteScopeTimezone: string | null;

  @ApiPropertyOptional({ nullable: true })
  siteScopeIsActive: boolean | null;

  @ApiProperty({ example: 'Création d’un site' })
  actionDisplayName: string;
}

export class PaginatedAuditEventResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] })
  items: AuditEventResponseDto[];
}
