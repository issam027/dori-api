import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class RegistrationResponseDto {
  @ApiProperty({ example: 101, description: "ID de l'inscription" })
  @IsUUID()
  registrationId: string;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  @IsUUID()
  queueId: string;

  @ApiProperty({ example: 45, description: 'ID de la personne cliente' })
  @IsUUID()
  personId: string;

  @ApiProperty({ example: 'A-012', description: 'Numéro de ticket généré' })
  ticketNumber: string;

  @ApiProperty({
    example: 'walkin',
    enum: ['walkin', 'appointment'],
    description: "Type d'entrée",
  })
  entryType: string;

  @ApiProperty({
    example: 'waiting',
    enum: [
      'booked',
      'waiting',
      'in_progress',
      'served',
      'no_show',
      'cancelled',
    ],
    description: 'Statut du traitement',
  })
  status: string;

  @ApiPropertyOptional({
    example: '10:30:00',
    description: 'Heure planifiée si RDV',
  })
  scheduledTime?: string;

  @ApiPropertyOptional({ example: 'confirmed', description: 'Statut du RDV' })
  appointmentStatus?: string;

  @ApiProperty({ example: '2026-09-27', description: 'Date métier' })
  businessDate: string;

  @ApiProperty({
    example: 'trk_9f8e7d6c5b4a...',
    description: 'Jeton public de suivi de position',
  })
  registrationTrackingToken: string;

  @ApiProperty({ example: 1, description: 'ID du forfait de service' })
  @IsUUID()
  tierId: string;

  @ApiProperty({
    example: '2026-09-27T08:30:00.000Z',
    description: "Date d'inscription",
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-27T08:30:00.000Z',
    description: 'Dernière modification',
  })
  updatedAt: string;

  @ApiProperty({ example: true }) isActive: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deletedAt?: string | null;

  @ApiPropertyOptional({ example: 'Leila' }) firstName?: string;
  @ApiPropertyOptional({ example: 'Ben Ali' }) lastName?: string;
  @ApiPropertyOptional({ example: 'Accueil général' }) queueName?: string;
  @ApiPropertyOptional({ example: 'Standard' }) tierName?: string;

  @ApiPropertyOptional({
    example: 45,
    nullable: true,
    description:
      "ID de la session opérateur ayant pris en charge l'inscription",
  })
  @IsUUID()
  servedBySessionId?: string | null;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description:
      "ID de l'utilisateur ayant pris en charge l'inscription, conservé directement sur l'inscription",
  })
  @IsUUID()
  servedByUserId?: string | null;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Nombre de notes actives associées à la personne concernée',
  })
  activeNoteCount: number;
}

export class CreateRegistrationResponseDto {
  @ApiProperty({ minimum: 1 }) registrationId: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty({ format: 'date' }) businessDate: string;
  @ApiProperty({ enum: ['walkin', 'appointment'] }) entryType: string;
  @ApiPropertyOptional({ nullable: true }) appointmentStatus?: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) scheduledTime?:
    string | null;
  @ApiProperty() status: string;
  @ApiProperty({ type: 'object' }) tier: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) priorityReferenceTime: string;
  @ApiProperty({
    format: 'uuid',
    description:
      'Jeton public de suivi, toujours retourné lors de la création de l’inscription',
  })
  registrationTrackingToken: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Date et heure d’expiration du jeton public de suivi',
  })
  registrationTrackingTokenValidUntil: string;
  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  estimatedWaitMinutes?: number | null;
  @ApiPropertyOptional() estimationMethod?: string;
  @ApiPropertyOptional() estimationReliable?: boolean;
  @ApiPropertyOptional({ format: 'date-time' }) estimationCalculatedAt?: string;
}

export class RescheduleRegistrationResponseDto {
  @ApiProperty({ minimum: 1 }) registrationId: string;
  @ApiProperty({ example: 'A-012' }) ticketNumber: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) appointmentStatus?: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) scheduledTime?:
    string | null;
  @ApiPropertyOptional({ format: 'date-time' }) priorityReferenceTime?: string;
}

export class PaginatedRegistrationResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [RegistrationResponseDto],
    description: 'Inscriptions trouvées',
  })
  items: RegistrationResponseDto[];

  @ApiProperty({ example: 1, description: 'Page courante' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 4, description: "Total d'inscriptions" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class SlotAvailabilityItemDto {
  @ApiProperty({
    example: '2026-10-01T09:00:00',
    description: 'Heure de début du créneau (ISO 8601 local)',
  })
  time: string;

  @ApiProperty({ example: 2, description: 'Capacité totale du créneau' })
  capacity: number;

  @ApiProperty({ example: 1, description: 'Nombre de places déjà réservées' })
  booked: number;

  @ApiProperty({ example: 1, description: 'Places restantes disponibles' })
  available: number;

  @ApiProperty({
    example: true,
    description: 'Vrai si au moins une place est disponible',
  })
  isAvailable: boolean;
}

export class DailyAvailabilityItemDto {
  @ApiProperty({ example: '2026-10-01', format: 'date' }) businessDate: string;
  @ApiProperty({ example: true }) isOpen: boolean;
  @ApiProperty({ example: 36 }) capacity: number;
  @ApiProperty({ example: 8 }) booked: number;
  @ApiProperty({ example: 28 }) available: number;
  @ApiPropertyOptional({ type: [SlotAvailabilityItemDto] })
  slots?: SlotAvailabilityItemDto[];
}

export class RegistrationAvailabilityResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  @IsUUID()
  queueId: string;

  @ApiProperty({ example: 'Europe/Berlin' }) timezone: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' }) dateFrom: string;

  @ApiProperty({ example: '2026-10-07', format: 'date' }) dateTo: string;

  @ApiProperty({
    type: [DailyAvailabilityItemDto],
    description: 'Disponibilités agrégées par journée',
  })
  days: DailyAvailabilityItemDto[];
}

export class RegistrationPositionResponseDto {
  @ApiPropertyOptional({ example: 'A-012', description: 'Numéro de ticket' })
  ticketNumber?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Position courante dans la file',
  })
  position?: number;

  @ApiPropertyOptional({
    example: 25,
    nullable: true,
    description: "Temps d'attente estimé en minutes",
  })
  estimatedWaitMinutes?: number | null;

  @ApiPropertyOptional({
    enum: [
      'queue_daily_p50',
      'last_calculated',
      'theoretical_queue',
      'unavailable',
    ],
  })
  estimationMethod?: string;

  @ApiPropertyOptional({ example: true })
  estimationReliable?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  estimationCalculatedAt?: string;

  @ApiProperty({ example: 'waiting', description: 'Statut du ticket' })
  status: string;

  @ApiProperty({
    enum: [
      'waiting',
      'in_progress',
      'served',
      'no_show',
      'cancelled',
      'expired',
    ],
    example: 'served',
    description:
      "Statut métier réel de l'inscription, y compris après sa clôture",
  })
  registrationStatus: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Numéro du guichet si appelé',
  })
  counterNumber?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Guichet 04',
    description: 'Nom complet du guichet ayant appelé le client',
  })
  counterName?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-15T09:42:18.000Z',
    description: "Date et heure de l'appel du client",
  })
  calledAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    example: '00000000-0000-4000-8000-000000000001',
    description: 'Identifiant UUID de la file',
  })
  @IsUUID()
  @IsOptional()
  queueId?: string;

  @ApiPropertyOptional({
    example: 'Consultation Cardiologie',
    description: 'Nom de la file',
  })
  queueName?: string;
}

export class DeleteRegistrationResponseDto {
  @ApiProperty({ example: 101, description: "ID de l'inscription annulée" })
  @IsUUID()
  registrationId: string;

  @ApiProperty({ example: true, description: 'Annulation confirmée' })
  cancelled: boolean;
}
