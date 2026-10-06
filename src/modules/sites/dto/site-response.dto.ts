import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class SiteDetailResponseDto {
  @ApiProperty({ example: 1, description: 'ID unique du site' })
  siteId: number;

  @ApiProperty({ example: 'Hôpital Aziza Othmana', description: 'Nom du site' })
  siteName: string;

  @ApiPropertyOptional({
    example: 'Tunis, Tunisie',
    description: 'Adresse du site',
  })
  siteLocation?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.dori.tn/logos/hao.png',
    description: 'URL du logo',
  })
  siteLogoUrl?: string;

  @ApiProperty({
    example: 'public',
    enum: ['public', 'private'],
    description: 'Type de site',
  })
  siteType: string;

  @ApiProperty({ example: 'Africa/Tunis', description: 'Fuseau horaire IANA' })
  timezone: string;

  @ApiProperty({ example: 'TND', description: 'Code devise par défaut' })
  defaultCurrency: string;

  @ApiProperty({ example: true, description: 'Statut actif du site' })
  isActive: boolean;

  @ApiProperty({
    example: false,
    description: 'Rendez-vous activés par défaut',
  })
  defaultAppointmentsEnabled: boolean;

  @ApiProperty({
    example: 15,
    description: 'Durée par créneau de RDV (minutes)',
  })
  defaultAppointmentSlotDuration: number;

  @ApiProperty({ example: 1, description: 'Capacité par créneau' })
  defaultSlotCapacity: number;

  @ApiProperty({
    example: '08:00:00',
    description: "Heure d'ouverture par défaut",
  })
  defaultWorkingHoursStart: string;

  @ApiProperty({
    example: '17:00:00',
    description: 'Heure de fermeture par défaut',
  })
  defaultWorkingHoursEnd: string;

  @ApiPropertyOptional({
    example: '12:00:00',
    description: 'Début de pause méridienne',
  })
  defaultBreakStart?: string;

  @ApiPropertyOptional({
    example: '14:00:00',
    description: 'Fin de pause méridienne',
  })
  defaultBreakEnd?: string;

  @ApiProperty({ example: 60, description: 'Tolérance retard RDV (minutes)' })
  defaultLateToleranceMinutes: number;

  @ApiProperty({ example: 0, description: 'Poids de base walk-in' })
  defaultBaseWeightWalkin: number;

  @ApiProperty({ example: 60, description: 'Poids de base rendez-vous' })
  defaultBaseWeightAppointment: number;

  @ApiProperty({ example: 1, description: "Taux d'escalade walk-in" })
  defaultEscalationRateWalkin: number;

  @ApiProperty({ example: 1, description: "Taux d'escalade rendez-vous" })
  defaultEscalationRateAppointment: number;

  @ApiProperty({
    example: false,
    description: 'Reporter les clients en attente au lendemain',
  })
  defaultCarryOverWaiting: boolean;

  @ApiProperty({
    example: 'close_all',
    enum: ['close_all', 'close_served_only'],
    description: 'Mode de réinitialisation',
  })
  defaultDailyResetMode: string;

  @ApiProperty({
    example: '03:00:00',
    description: 'Heure de réinitialisation quotidienne',
  })
  defaultDailyResetTime: string;

  @ApiProperty({ example: 'fr', description: 'Locale par défaut' })
  defaultLocale: string;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de mise à jour',
  })
  updatedAt: string;
}

export class PaginatedSiteResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [SiteDetailResponseDto],
    description: 'Liste des sites',
  })
  items: SiteDetailResponseDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 5, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class SiteDeleteResponseDto {
  @ApiProperty({ example: 1, description: 'ID du site supprimé' })
  siteId: number;

  @ApiProperty({ example: true, description: 'Confirmation de suppression' })
  deleted: boolean;
}

export class SiteManagerDetailDto {
  @ApiProperty({ example: 2, description: 'ID utilisateur du manager' })
  userId: number;

  @ApiProperty({ example: 'manager1', description: 'Identifiant du manager' })
  username: string;

  @ApiProperty({
    example: 'manager1@dori.local',
    description: 'Email du manager',
  })
  email: string;

  @ApiProperty({ example: true, description: 'Compte actif' })
  isActive: boolean;

  @ApiPropertyOptional({
    example: 'human',
    enum: ['human', 'kiosk'],
    description: 'Type de compte utilisateur',
  })
  userType?: string;

  @ApiPropertyOptional({
    example: '2026-09-28T10:00:00.000Z',
    description: "Date d'affectation au site",
  })
  assignedAt?: string;
}

export class PaginatedSiteManagerResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [SiteManagerDetailDto],
    description: 'Liste des managers du site',
  })
  items: SiteManagerDetailDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 2, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class AssignManagerResponseDto {
  @ApiProperty({ example: true, description: 'Opération réussie' })
  assigned: boolean;

  @ApiProperty({ example: 1, description: 'ID du site' })
  siteId: number;

  @ApiProperty({ example: 2, description: "ID de l'utilisateur" })
  userId: number;
}

export class RemoveManagerResponseDto {
  @ApiProperty({ minimum: 1 }) siteId: number;
  @ApiProperty({ minimum: 1 }) userId: number;
  @ApiProperty({ example: true }) removed: boolean;
}
