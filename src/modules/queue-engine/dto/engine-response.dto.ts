import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueueNextCandidateDto {
  @ApiProperty({ example: 102, description: "ID de l'inscription cliente" })
  customerId: number;

  @ApiProperty({ example: 'A-015', description: 'Numéro de ticket' })
  ticketNumber: string;

  @ApiProperty({
    example: 'walkin',
    enum: ['walkin', 'appointment'],
    description: "Type d'entrée",
  })
  entryType: string;

  @ApiProperty({
    example: 45.5,
    description: 'Score de priorité calculé par le moteur',
  })
  calculatedScore: number;

  @ApiProperty({ example: 25, description: 'Minutes passées en attente' })
  waitingMinutes: number;
}

export class QueuePreviewResponseDto {
  @ApiProperty({ example: 1, description: "ID de la file d'attente" })
  queueId: number;

  @ApiProperty({
    type: [QueueNextCandidateDto],
    description: 'Candidats éligibles ordonnés par priorité',
  })
  candidates: QueueNextCandidateDto[];
}

export class QueueThreadDto {
  @ApiProperty({ example: 1, description: 'Numéro du guichet' })
  threadNumber: number;

  @ApiProperty({
    example: true,
    description: 'Indique si le guichet est actuellement ouvert',
  })
  isOpen: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: "ID de l'opérateur connecté au guichet",
  })
  operatorUserId?: number;

  @ApiPropertyOptional({
    example: 'A-010',
    description: 'Ticket actuellement en cours de traitement',
  })
  currentTicketNumber?: string;
}

export class QueueSessionDetailDto {
  @ApiProperty({ example: 12, description: 'ID de la session de guichet' })
  sessionId: number;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 1, description: 'Numéro du guichet' })
  threadNumber: number;

  @ApiProperty({ example: 2, description: "ID de l'utilisateur opérateur" })
  userId: number;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'paused', 'closed'],
    description: 'Mode de la session',
  })
  mode: string;

  @ApiProperty({
    example: '2026-09-27T08:00:00.000Z',
    description: 'Heure de connexion',
  })
  connectedAt: string;

  @ApiPropertyOptional({ example: null, description: 'Heure de déconnexion' })
  disconnectedAt?: string;
}

export class CalledNextCustomerResponseDto {
  @ApiProperty({ example: 102, description: "ID de l'inscription appelée" })
  customerId: number;

  @ApiProperty({ example: 'A-015', description: 'Numéro de ticket appelé' })
  ticketNumber: string;

  @ApiProperty({ example: 1, description: 'Numéro du guichet assigné' })
  threadNumber: number;

  @ApiProperty({
    example: 'in_progress',
    description: "Nouveau statut de l'inscription",
  })
  status: string;

  @ApiProperty({
    example: '2026-09-27T10:15:00.000Z',
    description: "Horodatage de l'appel",
  })
  calledAt: string;
}

export class CloseSessionResponseDto {
  @ApiProperty({ example: 12, description: 'ID de la session fermée' })
  sessionId: number;

  @ApiProperty({ example: true, description: 'Session clôturée avec succès' })
  closed: boolean;
}

export class CustomerActionResponseDto {
  @ApiProperty({ example: 102, description: "ID de l'inscription" })
  customerId: number;

  @ApiProperty({
    example: 'served',
    enum: ['served', 'no_show'],
    description: 'Statut final appliqué',
  })
  status: string;

  @ApiProperty({
    example: '2026-09-27T10:35:00.000Z',
    description: "Horodatage de l'action",
  })
  completedAt: string;
}
