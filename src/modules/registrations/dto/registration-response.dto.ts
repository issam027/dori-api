import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class RegistrationDetailResponseDto {
  @ApiProperty({ example: 101, description: "ID de l'inscription" })
  customerId: number;

  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: 45, description: 'ID de la personne cliente' })
  personId: number;

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
  tierId: number;

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
}

export class PaginatedRegistrationResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [RegistrationDetailResponseDto],
    description: 'Inscriptions trouvées',
  })
  items: RegistrationDetailResponseDto[];

  @ApiProperty({ example: 1, description: 'Page courante' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 4, description: "Total d'inscriptions" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class SlotAvailabilityDto {
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

export class AvailabilityResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la file' })
  queueId: number;

  @ApiProperty({ example: '2026-09-27', description: 'Date interrogée' })
  date: string;

  @ApiProperty({
    type: [SlotAvailabilityDto],
    description: 'Créneaux horaires et disponibilités',
  })
  slots: SlotAvailabilityDto[];
}

export class PublicPositionResponseDto {
  @ApiProperty({ example: 'A-012', description: 'Numéro de ticket' })
  ticketNumber: string;

  @ApiProperty({ example: 3, description: 'Position courante dans la file' })
  position: number;

  @ApiProperty({
    example: 25,
    description: "Temps d'attente estimé en minutes",
  })
  estimatedWaitMinutes: number;

  @ApiProperty({ example: 'waiting', description: 'Statut du ticket' })
  status: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Numéro du guichet si appelé',
  })
  counterNumber?: number;

  @ApiProperty({
    example: 'Consultation Cardiologie',
    description: 'Nom de la file',
  })
  queueName: string;
}

export class RegistrationDeleteResponseDto {
  @ApiProperty({ example: 101, description: "ID de l'inscription annulée" })
  registrationId: number;

  @ApiProperty({ example: true, description: 'Annulation confirmée' })
  deleted: boolean;
}
