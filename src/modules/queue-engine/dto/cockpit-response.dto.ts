import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallNextTierItemDto } from './engine-response.dto';

export class CockpitOperatorItemDto {
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() username: string;
  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;
}

export class CockpitSessionItemDto {
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiProperty({ type: String, nullable: true })
  counterName: string | null;
  @ApiProperty() operatorName: string;
  @ApiProperty() ownedByCurrentOperator: boolean;
}

export class CockpitReplaceableSessionItemDto {
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty({ minimum: 1 }) threadNumber: number;
  @ApiProperty({ type: String, nullable: true })
  counterName: string | null;
  @ApiProperty() operatorName: string;
}

export class CockpitSessionOpeningItemDto {
  @ApiProperty() allowed: boolean;
  @ApiProperty({ type: [Number], minimum: 1 }) availableThreadNumbers: number[];
  @ApiProperty() requiresReplacement: boolean;
  @ApiProperty({ type: [CockpitReplaceableSessionItemDto] })
  replaceableSessions: CockpitReplaceableSessionItemDto[];
}

export class CockpitCentralizedNextItemDto {
  @ApiProperty() eligible: boolean;
  @ApiProperty({
    enum: ['no_session', 'active_call_in_progress'],
    nullable: true,
  })
  unavailableReason: 'no_session' | 'active_call_in_progress' | null;
}

export class CockpitPersonItemDto {
  @ApiProperty({ format: 'uuid' }) personId: string;
  @ApiProperty({ type: String, nullable: true })
  firstName: string | null;
  @ApiProperty({ type: String, nullable: true })
  lastName: string | null;
}

export class CockpitActiveCallItemDto {
  @ApiProperty({ format: 'uuid' }) registrationId: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ enum: ['in_progress'] }) status: 'in_progress';
  @ApiProperty({ enum: ['walkin', 'appointment'] })
  entryType: 'walkin' | 'appointment';
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledTime: string | null;
  @ApiProperty({ format: 'date-time' }) calledAt: string | Date;
  @ApiProperty({ minimum: 0 }) recallCount: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastRecalledAt: string | Date | null;
  @ApiProperty({ type: CockpitPersonItemDto }) person: CockpitPersonItemDto;
  @ApiProperty({ type: CallNextTierItemDto }) tier: CallNextTierItemDto;
  @ApiProperty({ minimum: 0 }) notesCount: number;
}

export class CockpitCandidateItemDto {
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ enum: ['walkin', 'appointment'] })
  entryType: 'walkin' | 'appointment';
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledTime: string | null;
  @ApiProperty({ format: 'date-time' }) priorityReferenceTime: string | Date;
  @ApiProperty() priorityScore: number;
  @ApiProperty() calledEarly: boolean;
  @ApiProperty({ type: CallNextTierItemDto }) tier: CallNextTierItemDto;
}

export class CockpitQueueItemDto {
  @ApiProperty({ format: 'uuid' }) queueId: string;
  @ApiProperty() queueCode: string;
  @ApiProperty() queueName: string;
  @ApiProperty({ minimum: 0 }) waitingCount: number;
  @ApiProperty({ minimum: 0 }) remainingAppointmentsCount: number;
  @ApiProperty({ type: Number, minimum: 0, nullable: true })
  estimatedWaitMinutes: number | null;
  @ApiProperty({ minimum: 1 }) threadCount: number;
  @ApiProperty({ minimum: 0 }) occupiedThreadsCount: number;
  @ApiProperty({ type: [Number], minimum: 1 }) availableThreadNumbers: number[];
  @ApiProperty({ type: [CockpitSessionItemDto] })
  sessions: CockpitSessionItemDto[];
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  currentOperatorSessionId: string | null;
  @ApiProperty({ type: CockpitSessionOpeningItemDto })
  sessionOpening: CockpitSessionOpeningItemDto;
  @ApiProperty({ type: CockpitCentralizedNextItemDto })
  centralizedNext: CockpitCentralizedNextItemDto;
  @ApiProperty({ type: CockpitActiveCallItemDto, nullable: true })
  activeCall: CockpitActiveCallItemDto | null;
  @ApiProperty({ type: [CockpitCandidateItemDto] })
  nextCandidates: CockpitCandidateItemDto[];
}

export class CockpitRecentPassageItemDto {
  @ApiProperty({ format: 'uuid' }) registrationId: string;
  @ApiProperty({ format: 'uuid' }) queueId: string;
  @ApiProperty() queueName: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty() personName: string;
  @ApiProperty({ type: Number, minimum: 1, nullable: true })
  threadNumber: number | null;
  @ApiProperty({ type: String, nullable: true })
  counterName: string | null;
  @ApiProperty({ format: 'date-time' }) calledAt: string | Date;
  @ApiProperty({ format: 'date-time' }) closedAt: string | Date;
  @ApiProperty({ enum: ['served', 'no_show'] }) outcome: 'served' | 'no_show';
}

export class CockpitResponseDto {
  @ApiProperty({ format: 'uuid' }) siteId: string;
  @ApiProperty() siteName: string;
  @ApiProperty({ format: 'date-time' }) serverTime: string | Date;
  @ApiProperty({ type: CockpitOperatorItemDto })
  operator: CockpitOperatorItemDto;
  @ApiProperty({ type: [CockpitQueueItemDto] }) queues: CockpitQueueItemDto[];
  @ApiProperty({ type: [CockpitRecentPassageItemDto] })
  recentPassages: CockpitRecentPassageItemDto[];
}
