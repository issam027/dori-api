import {
  IsDateString,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonIdentityDto } from '../../persons/dto/person.dto';
import { PaginationDto } from '../../../core/pagination/pagination.dto';
import {
  ExactlyOneOf,
  ValidRegistrationLookup,
  ValidRegistrationSchedule,
} from '../../../core/validation/domain-validation.decorators';
import {
  DATE_RANGE_LIMITS,
  DateRangeQueryDto,
  IsCalendarDate,
  ValidDateRange,
} from '../../../core/dates/date-range.dto';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

@ExactlyOneOf(['personId', 'person'])
@ValidRegistrationSchedule()
export class CreateRegistrationDto {
  @ApiPropertyOptional({
    example: 5,
    description: "ID d'une personne existante (si connue)",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  personId?: number;

  @ApiPropertyOptional({
    type: () => PersonIdentityDto,
    description: 'Créer une nouvelle personne à la volée',
  })
  @ValidateNested()
  @Type(() => PersonIdentityDto)
  @IsOptional()
  person?: PersonIdentityDto;

  @ApiProperty({ example: 1, description: 'ID de la queue cible' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  queueId: number;

  @ApiProperty({
    enum: ['walkin', 'appointment'],
    example: 'walkin',
    description: "Type d'entrée",
  })
  @IsIn(['walkin', 'appointment'])
  @IsNotEmpty()
  entryType: 'walkin' | 'appointment';

  @ApiPropertyOptional({
    example: '2026-10-01T09:00:00Z',
    description: 'Créneau RDV (ISO 8601, requis si entryType=appointment)',
  })
  @IsDateString()
  @IsOptional()
  scheduledTime?: string;

  @ApiProperty({ example: 1, description: 'ID du forfait (tier) choisi' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  tierId: number;

  @ApiPropertyOptional({
    example: 'fr',
    description: 'Préférence de langue du client',
  })
  @IsString()
  @IsOptional()
  languagePreference?: string;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional({ example: 2, description: 'Changer de forfait' })
  @IsInt()
  @IsOptional()
  tierId?: number;

  @ApiPropertyOptional({ example: 'ar' })
  @IsString()
  @IsOptional()
  languagePreference?: string;

  @ApiPropertyOptional({ description: "Activer ou désactiver l'inscription" })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RescheduleRegistrationDto {
  @ApiProperty({
    example: '2026-10-02T10:30:00Z',
    description: 'Nouveau créneau RDV (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledTime: string;
}

@ValidRegistrationLookup()
export class LookupRegistrationDto {
  @ApiPropertyOptional({
    example: '+21698765432',
    description:
      'Numéro de téléphone E.164 pour rechercher les rendez-vous du jour',
    pattern: '^\\+[1-9][0-9]{6,14}$',
  })
  @IsString()
  @Matches(/^\+[1-9][0-9]{6,14}$/, {
    message: 'Phone number must be E.164 format with leading +',
  })
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Ben Ali',
    description: 'Nom de famille (combiné avec scheduledTime)',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '2026-10-01T09:00:00Z' })
  @IsDateString()
  @IsOptional()
  scheduledTime?: string;
}

@ValidDateRange(DATE_RANGE_LIMITS.registrationFilterDays)
export class RegistrationFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'true retourne les inscriptions actives, false les désactivées. Sans paramètre, seules les actives sont retournées.',
  })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  queueId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  siteId?: number;

  @ApiPropertyOptional({
    example: '2026-10-01',
    format: 'date',
    description:
      'Première date incluse : businessDate pour un walk-in, scheduledTime dans le fuseau du site pour un rendez-vous. Doit être fournie avec dateTo et avec queueId ou siteId.',
  })
  @IsCalendarDate()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    format: 'date',
    description:
      'Dernière date incluse : businessDate pour un walk-in, scheduledTime dans le fuseau du site pour un rendez-vous. La période complète est limitée à 366 jours.',
  })
  @IsCalendarDate()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    example: 'waiting',
    description: 'Filtrer par statut',
  })
  @IsIn([
    'booked',
    'waiting',
    'in_progress',
    'served',
    'no_show',
    'cancelled',
    'expired',
  ])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: ['walkin', 'appointment'] })
  @IsIn(['walkin', 'appointment'])
  @IsOptional()
  entryType?: string;

  @ApiPropertyOptional({
    example: 'booked',
    enum: [
      'n/a',
      'booked',
      'checked_in',
      'rescheduled',
      'cancelled',
      'expired',
    ],
  })
  @IsIn(['n/a', 'booked', 'checked_in', 'rescheduled', 'cancelled', 'expired'])
  @IsOptional()
  appointmentStatus?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  personId?: number;

  @ApiPropertyOptional({
    example: 12,
    description:
      "Filtrer par l'identifiant de l'utilisateur ayant servi le client",
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  servedByUserId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  tierId?: number;

  @ApiPropertyOptional({ description: 'Recherche libre (nom, ticket)' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class RegistrationAvailabilityQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Omet les créneaux et retourne uniquement les totaux journaliers.',
  })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  summaryOnly: boolean = false;
}
