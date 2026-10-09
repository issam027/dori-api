import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class QueueCandidatePersonItemDto {
  @ApiProperty({ minimum: 1 }) personId: number;
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
}

export class QueuePreviewItemDto {
  @ApiProperty({ minimum: 1 }) registrationId: number;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ minimum: 1 }) queueId: number;
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
  @ApiProperty({ minimum: 1 }) sessionId: number;
  @ApiProperty({ minimum: 1 }) userId: number;
  @ApiProperty() username: string;
  @ApiProperty({ format: 'date-time' }) connectedAt: string;
  @ApiProperty({ format: 'date-time' }) lastSeenAt: string;
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
  @ApiProperty({ minimum: 1 }) sessionId: number;
  @ApiProperty({ minimum: 1 }) queueId: number;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) threadNumber?:
    number | null;
  @ApiProperty({ minimum: 1 }) userId: number;
  @ApiProperty({ enum: ['active', 'consultation_only'] }) mode: string;
  @ApiProperty({ format: 'date-time' }) connectedAt: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  disconnectedAt?: string | null;
  @ApiPropertyOptional() username?: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) takenOverFromSessionId?:
    number | null;
  @ApiPropertyOptional({ minimum: 1, nullable: true })
  reassignedRegistrationId?: number | null;
}

export class PaginatedQueueSessionResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [QueueSessionResponseDto] })
  items: QueueSessionResponseDto[];
}

export class CallNextRegistrationResponseDto {
  @ApiProperty({ minimum: 1 }) registrationId: number;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ enum: ['walkin', 'appointment'] }) entryType: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) scheduledTime?:
    string | null;
  @ApiProperty() calledEarly: boolean;
  @ApiProperty({ type: 'object' }) tier: Record<string, unknown>;
  @ApiProperty({ example: 'in_progress' }) status: string;
  @ApiProperty({ minimum: 1 }) sessionId: number;
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiProperty() priorityScore: number;
  @ApiProperty({ format: 'date-time' }) calledAt: string;
  @ApiProperty({ type: 'object' }) person: Record<string, unknown>;
}

export class CloseSessionResponseDto {
  @ApiProperty({ minimum: 1 }) sessionId: number;
  @ApiProperty() closed: boolean;
}

export class UpdateRegistrationStatusResponseDto {
  @ApiProperty({ minimum: 1 }) registrationId: number;
  @ApiProperty({ enum: ['served', 'no_show'] }) status: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) servedAt?:
    string | null;
  @ApiProperty({ format: 'date-time' }) closedAt: string;
  @ApiProperty({ minimum: 1 }) handledBySessionId: number;
  @ApiProperty({ minimum: 1 }) handledByUserId: number;
}
