import { IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class QueueCandidatePersonItemDto {
  @ApiProperty({ minimum: 1 }) personId: string;
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
}

export class QueuePreviewItemDto {
  @ApiProperty({ minimum: 1 }) registrationId: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ minimum: 1 }) queueId: string;
  @ApiProperty() queueCode: string;
  @ApiProperty() queueName: string;
  @ApiProperty() siteName: string;
  @ApiProperty({ enum: ['walkin', 'appointment'] }) entryType: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) scheduledTime?:
    string | null;
  @ApiProperty() priorityScore: number;
  @ApiProperty() calledEarly: boolean;
  @ApiProperty({ type: QueueCandidatePersonItemDto })
  person: QueueCandidatePersonItemDto;
}

export class ThreadSessionItemDto {
  @ApiProperty({ minimum: 1 }) sessionId: string;
  @ApiProperty({ minimum: 1 }) userId: string;
  @ApiProperty() username: string;
  @ApiProperty({ format: 'date-time' }) connectedAt: string | Date;
  @ApiProperty({ format: 'date-time' }) lastSeenAt: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Guichet 04' })
  counterName?: string | null;
  @ApiProperty({ minimum: 0 }) inactiveMinutes: number;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) currentRegistrationId?:
    number | null;
}

export class QueueThreadResponseDto {
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiProperty({ enum: ['occupied', 'free'] }) status: string;
  @ApiPropertyOptional({ type: ThreadSessionItemDto, nullable: true })
  session: ThreadSessionItemDto | null;
}

export class PaginatedQueueThreadResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [QueueThreadResponseDto] })
  items: QueueThreadResponseDto[];
}

export class QueueSessionResponseDto {
  @ApiProperty({ minimum: 1 }) sessionId: string;
  @ApiProperty({ minimum: 1 }) queueId: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) threadNumber?:
    number | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Guichet 04' })
  counterName?: string | null;
  @ApiProperty({ minimum: 1 }) userId: string;
  @ApiProperty({ enum: ['active', 'consultation_only'] }) mode: string;
  @ApiProperty({ format: 'date-time' }) connectedAt: string | Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  disconnectedAt?: string | Date | null;
  @ApiPropertyOptional() username?: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) takenOverFromSessionId?:
    number | null;
  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsUUID()
  reassignedRegistrationId?: string | null;
}

export class PaginatedQueueSessionResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [QueueSessionResponseDto] })
  items: QueueSessionResponseDto[];
}

export class CallNextTierItemDto {
  @ApiProperty({ format: 'uuid', description: 'ID du niveau de service' })
  tierId: string;

  @ApiProperty({
    example: 'STANDARD',
    description: 'Code du niveau de service',
  })
  tierCode: string;

  @ApiProperty({ example: 'Standard', description: 'Nom du niveau de service' })
  tierName: string;
}

export class CallNextPersonItemDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la personne appelée' })
  personId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Leila',
    description: 'Prénom de la personne',
  })
  firstName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Ben Ali',
    description: 'Nom de la personne',
  })
  lastName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '+491500012261',
    description: 'Numéro de téléphone de la personne',
  })
  phone?: string | null;

  @ApiProperty({
    example: false,
    description: 'Indique si la personne possède au moins une note active',
  })
  hasNotes: boolean;
}

export class CallNextQueueItemDto {
  @ApiProperty({ format: 'uuid' }) queueId: string;
  @ApiProperty() queueName: string;
}

export class CallNextRegistrationResponseDto {
  @ApiProperty({ format: 'uuid' }) registrationId: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ enum: ['walkin', 'appointment'] }) entryType: string;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-26T10:30:00.000Z',
    description:
      'Date et heure planifiées pour un rendez-vous, null pour une arrivée sans rendez-vous',
  })
  scheduledTime?: string | null;
  @ApiProperty() calledEarly: boolean;
  @ApiProperty({ type: CallNextTierItemDto }) tier: CallNextTierItemDto;
  @ApiProperty({ example: 'in_progress' }) status: string;
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiProperty() priorityScore: number;
  @ApiProperty({ format: 'date-time' }) calledAt: string;
  @ApiProperty({ type: CallNextPersonItemDto }) person: CallNextPersonItemDto;
}

export class SiteCallNextResponseDto extends CallNextRegistrationResponseDto {
  @ApiProperty({ type: CallNextQueueItemDto }) queue: CallNextQueueItemDto;
}

export class RecallRegistrationResponseDto {
  @ApiProperty({ format: 'uuid' }) registrationId: string;
  @ApiProperty({ format: 'uuid' }) queueId: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ example: 'in_progress' }) status: string;
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Guichet 3' })
  counterName: string | null;
  @ApiProperty({ format: 'date-time' }) lastRecalledAt: string | Date;
  @ApiProperty({ minimum: 1, example: 1 }) recallCount: number;
}

export class CloseSessionResponseDto {
  @ApiProperty({ minimum: 1 }) sessionId: string;
  @ApiProperty() closed: boolean;
}

export class UpdateRegistrationStatusResponseDto {
  @ApiProperty({ minimum: 1 }) registrationId: string;
  @ApiProperty({ enum: ['served', 'no_show'] }) status: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) servedAt?:
    string | null;
  @ApiProperty({ format: 'date-time' }) closedAt: string;
  @ApiProperty({ minimum: 1 }) handledBySessionId: string;
  @ApiProperty({ minimum: 1 }) handledByUserId: string;
}
