import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenSessionResponseDto {
  @ApiProperty({ example: 12 })
  sessionId!: number;

  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 5 })
  userId!: number;

  @ApiPropertyOptional({ example: 2, nullable: true, description: 'Numéro de guichet physique ou null en mode consultation' })
  threadNumber?: number | null;

  @ApiProperty({ example: 'active', enum: ['active', 'consultation_only'] })
  mode!: string;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  connectedAt!: string;

  @ApiPropertyOptional({ example: 10, nullable: true })
  takenOverFromSessionId?: number | null;

  @ApiPropertyOptional({ example: 101, nullable: true })
  reassignedRegistrationId?: number | null;
}

export class CalledPersonDto {
  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Mohamed' })
  firstName!: string;

  @ApiProperty({ example: 'Trabelsi' })
  lastName!: string;

  @ApiProperty({ example: '+21698123456' })
  phone!: string;

  @ApiProperty({ example: true, description: 'Indique si le client possède des notes internes actives' })
  hasNotes!: boolean;
}

export class CalledTierDto {
  @ApiProperty({ example: 1 })
  tierId!: number;

  @ApiProperty({ example: 'free' })
  tierCode!: string;

  @ApiProperty({ example: 'Gratuit / Standard' })
  tierName!: string;
}

export class CallNextResponseDto {
  @ApiProperty({ example: 101 })
  registrationId!: number;

  @ApiProperty({ example: 'MED001' })
  ticketNumber!: string;

  @ApiProperty({ example: 'walkin', enum: ['walkin', 'appointment'] })
  entryType!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  scheduledTime?: string | null;

  @ApiProperty({ example: false, description: 'Vrai si appelé en avance pour éviter l’inactivité du guichet' })
  calledEarly!: boolean;

  @ApiProperty({ type: CalledTierDto })
  tier!: CalledTierDto;

  @ApiProperty({ example: 'in_progress' })
  status!: string;

  @ApiProperty({ example: 12 })
  sessionId!: number;

  @ApiPropertyOptional({ example: 2, nullable: true })
  threadNumber?: number | null;

  @ApiProperty({ example: 45.2, description: 'Score de priorité dynamique calculé (§4.4)' })
  priorityScore!: number;

  @ApiPropertyOptional({ example: '2026-09-20T09:00:00.000Z', nullable: true })
  calledAt?: string | null;

  @ApiProperty({ type: CalledPersonDto })
  person!: CalledPersonDto;
}

export class CompleteRegistrationResponseDto {
  @ApiProperty({ example: 101 })
  registrationId!: number;

  @ApiProperty({ example: 'served', enum: ['served', 'no_show'] })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-20T09:15:00.000Z', nullable: true })
  servedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-09-20T09:15:00.000Z', nullable: true })
  closedAt?: string | null;

  @ApiPropertyOptional({ example: 12, nullable: true })
  handledBySessionId?: number | null;

  @ApiProperty({ example: 5 })
  handledByUserId!: number;
}
