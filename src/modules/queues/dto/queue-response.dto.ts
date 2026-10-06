import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class QueueDetailResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 'CARDIO-01', description: 'Code unique de la file' })
  queueCode: string;

  @ApiProperty({ example: 1, description: 'ID du site' })
  siteId: number;

  @ApiProperty({
    example: 'Consultation Cardiologie',
    description: 'Nom de la file',
  })
  queueName: string;

  @ApiProperty({
    example: 15,
    description: 'Temps moyen de prise en charge en minutes',
  })
  averageWaitTime: number;

  @ApiProperty({ example: 3, description: 'Nombre de guichets (threads)' })
  threadCount: number;

  @ApiProperty({
    example: true,
    description: 'Indique si les rendez-vous sont activés',
  })
  appointmentsEnabled: boolean;

  @ApiProperty({
    example: 15,
    description: "Durée d'un créneau de RDV (minutes)",
  })
  appointmentSlotDuration: number;

  @ApiProperty({ example: 1, description: 'Capacité par créneau de RDV' })
  slotCapacity: number;

  @ApiProperty({
    example: '08:00:00',
    description: "Heure d'ouverture (HH:mm:ss)",
  })
  workingHoursStart: string;

  @ApiProperty({
    example: '17:00:00',
    description: 'Heure de fermeture (HH:mm:ss)',
  })
  workingHoursEnd: string;

  @ApiPropertyOptional({ example: '12:00:00', description: 'Début de pause' })
  breakStart?: string;

  @ApiPropertyOptional({ example: '14:00:00', description: 'Fin de pause' })
  breakEnd?: string;

  @ApiProperty({ example: 60, description: 'Tolérance retard RDV en minutes' })
  lateToleranceMinutes: number;

  @ApiProperty({ example: 0, description: 'Poids de base walk-in' })
  baseWeightWalkin: number;

  @ApiProperty({ example: 60, description: 'Poids de base rendez-vous' })
  baseWeightAppointment: number;

  @ApiProperty({ example: true, description: 'File active ou inactive' })
  isActive: boolean;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt: string;
}

export class PaginatedQueueResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [QueueDetailResponseDto],
    description: 'Liste des files',
  })
  items: QueueDetailResponseDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class NextAppointmentItemDto {
  @ApiProperty({ example: 42, description: "ID de l'inscription client" })
  registrationId: number;

  @ApiProperty({ example: 'A-012', description: 'Numéro de ticket' })
  ticketNumber: string;

  @ApiProperty({ example: '10:30:00', description: 'Heure prévue du RDV' })
  scheduledTime: string;

  @ApiProperty({ example: 'confirmed', description: 'Statut du RDV' })
  appointmentStatus: string;

  @ApiProperty({ example: 'waiting', description: "Statut de l'inscription" })
  status: string;
}

export class QueueStatusResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({
    example: 4,
    description: "Nombre de personnes en attente aujourd'hui",
  })
  waitingCount: number;

  @ApiProperty({
    example: 2,
    description: 'Nombre de guichets actuellement actifs',
  })
  activeThreads: number;

  @ApiProperty({
    example: 30,
    description: "Temps d'attente estimé en minutes",
  })
  estimatedWaitMinutes: number;

  @ApiProperty({
    type: [NextAppointmentItemDto],
    description: 'Prochains rendez-vous programmés',
  })
  nextAppointments: NextAppointmentItemDto[];
}

export class CallingTicketDetailDto {
  @ApiProperty({ example: 1, description: 'Numéro du guichet' })
  threadNumber: number;

  @ApiPropertyOptional({
    example: 'A-007',
    nullable: true,
    description: 'Numéro de ticket en cours de traitement',
  })
  currentTicket: string | null;

  @ApiPropertyOptional({
    example: '2026-09-27T10:15:00.000Z',
    description: "Heure de l'appel",
  })
  calledAt?: string;
}

export class QueueDisplayResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiPropertyOptional({
    example: 'Consultation Cardiologie',
    description: 'Nom de la file',
  })
  queueName?: string;

  @ApiProperty({
    type: [CallingTicketDetailDto],
    description: 'Tickets actuellement appelés aux guichets',
  })
  activeThreads: CallingTicketDetailDto[];

  @ApiProperty({ type: [String], description: 'Prochains numéros de ticket' })
  nextTickets: string[];
}

export class QueueDeleteResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file supprimée' })
  queueId: number;

  @ApiProperty({ example: true, description: 'Confirmation de la suppression' })
  deleted: boolean;
}

export class QueueResetResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file réinitialisée' })
  queueId: number;

  @ApiProperty({
    example: '2026-09-27T12:00:00.000Z',
    description: 'Horodatage de la réinitialisation',
  })
  timestamp: string;

  @ApiProperty({ example: true, description: 'Réinitialisation confirmée' })
  reset: boolean;
}

export class QueueOperatorResponseDto {
  @ApiProperty({ example: 3, description: "ID de l'utilisateur opérateur" })
  userId: number;

  @ApiProperty({
    example: 'hotesse1',
    description: "Identifiant de l'opérateur",
  })
  username: string;

  @ApiProperty({
    example: 'hotesse1@dori.local',
    description: "Email de l'opérateur",
  })
  email: string;

  @ApiProperty({ example: true, description: 'Statut du compte' })
  isActive: boolean;
}

export class PaginatedQueueOperatorResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [QueueOperatorResponseDto],
    description: 'Liste des opérateurs',
  })
  items: QueueOperatorResponseDto[];

  @ApiProperty({ example: 1, description: 'Numéro de page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 10, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class AssignOperatorResponseDto {
  @ApiProperty({ example: true, description: 'Opération réussie' })
  assigned: boolean;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 3, description: "ID de l'utilisateur" })
  userId: number;
}

export class RemoveOperatorResponseDto {
  @ApiProperty({ minimum: 1 }) queueId: number;
  @ApiProperty({ minimum: 1 }) userId: number;
  @ApiProperty({ example: true }) removed: boolean;
}
