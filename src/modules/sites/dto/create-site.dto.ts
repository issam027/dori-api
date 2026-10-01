import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'Hôpital Aziza Othmana', description: 'Nom du site' })
  @IsString()
  @IsNotEmpty()
  siteName: string;

  @ApiPropertyOptional({
    example: 'Tunis, Tunisie',
    description: 'Adresse ou localisation',
  })
  @IsString()
  @IsOptional()
  siteLocation?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.dori.tn/logos/hao.png',
    description: 'URL du logo',
  })
  @IsString()
  @IsOptional()
  siteLogoUrl?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], example: 'public' })
  @IsIn(['public', 'private'])
  @IsOptional()
  siteType?: 'public' | 'private';

  @ApiPropertyOptional({
    example: 'Africa/Tunis',
    description: 'Fuseau horaire IANA',
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({
    example: 'TND',
    description: 'Code devise ISO 4217 (3 lettres)',
  })
  @IsString()
  @IsOptional()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Activer les rendez-vous par défaut',
  })
  @IsBoolean()
  @IsOptional()
  defaultAppointmentsEnabled?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Durée d'un créneau (minutes)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultAppointmentSlotDuration?: number;

  @ApiPropertyOptional({ example: 1, description: 'Capacité par créneau' })
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultSlotCapacity?: number;

  @ApiPropertyOptional({
    example: '08:00',
    description: "Heure d'ouverture (HH:mm)",
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  defaultWorkingHoursStart?: string;

  @ApiPropertyOptional({
    example: '17:00',
    description: 'Heure de fermeture (HH:mm)',
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  defaultWorkingHoursEnd?: string;

  @ApiPropertyOptional({
    example: '12:00',
    description: 'Début de pause méridienne (HH:mm)',
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  defaultBreakStart?: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'Fin de pause méridienne (HH:mm)',
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  defaultBreakEnd?: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Tolérance retard RDV (minutes)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultLateToleranceMinutes?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Poids de base walk-in (priorité)',
  })
  @IsNumber()
  @IsOptional()
  defaultBaseWeightWalkin?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Poids de base rendez-vous (priorité)',
  })
  @IsNumber()
  @IsOptional()
  defaultBaseWeightAppointment?: number;

  @ApiPropertyOptional({ example: 1, description: "Taux d'escalade walk-in" })
  @IsNumber()
  @IsOptional()
  defaultEscalationRateWalkin?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Taux d'escalade rendez-vous",
  })
  @IsNumber()
  @IsOptional()
  defaultEscalationRateAppointment?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Reporter les clients en attente au lendemain',
  })
  @IsBoolean()
  @IsOptional()
  defaultCarryOverWaiting?: boolean;

  @ApiPropertyOptional({
    enum: ['close_all', 'close_served_only'],
    example: 'close_all',
  })
  @IsIn(['close_all', 'close_served_only'])
  @IsOptional()
  defaultDailyResetMode?: 'close_all' | 'close_served_only';

  @ApiPropertyOptional({
    example: '03:00',
    description: 'Heure de reset journalier (HH:mm)',
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  defaultDailyResetTime?: string;

  @ApiPropertyOptional({
    example: 'fr',
    description: 'Locale par défaut (ISO 639-1)',
  })
  @IsString()
  @IsOptional()
  defaultLocale?: string;
}
