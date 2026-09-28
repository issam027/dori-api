import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePersonDto } from '../../persons/dto/person.dto';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class CreateRegistrationDto {
  @ApiPropertyOptional({
    example: 5,
    description: "ID d'une personne existante (si connue)",
  })
  @IsInt()
  @IsOptional()
  personId?: number;

  @ApiPropertyOptional({
    type: () => CreatePersonDto,
    description: 'Créer une nouvelle personne à la volée',
  })
  @ValidateNested()
  @Type(() => CreatePersonDto)
  @IsOptional()
  person?: CreatePersonDto;

  @ApiProperty({ example: 1, description: 'ID de la queue cible' })
  @IsInt()
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
}

export class RescheduleDto {
  @ApiProperty({
    example: '2026-10-02T10:30:00Z',
    description: 'Nouveau créneau RDV (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledTime: string;
}

export class LookupRegistrationDto {
  @ApiPropertyOptional({
    example: 'MED-0042',
    description: 'Numéro de ticket à rechercher',
  })
  @IsString()
  @IsOptional()
  ticketNumber?: string;

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

export class RegistrationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  queueId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  siteId?: number;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Date métier (YYYY-MM-DD)',
  })
  @IsString()
  @IsOptional()
  businessDate?: string;

  @ApiPropertyOptional({
    example: 'waiting',
    description: 'Filtrer par statut',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: ['walkin', 'appointment'] })
  @IsString()
  @IsOptional()
  entryType?: string;

  @ApiPropertyOptional({ example: 'booked' })
  @IsString()
  @IsOptional()
  appointmentStatus?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  personId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  tierId?: number;

  @ApiPropertyOptional({ description: 'Recherche libre (nom, ticket)' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class AvailabilityQueryDto extends PaginationDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'Date à consulter (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
