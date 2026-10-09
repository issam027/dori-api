import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class PersonIdentityDto {
  @ApiPropertyOptional({ example: 'Mohamed', description: 'Prénom' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    example: 'Ben Ali',
    description: 'Nom de famille obligatoire',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    example: 'mohamed.benali@example.tn',
    description: 'Adresse e-mail',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+21698765432',
    description: 'Numéro de téléphone au format E.164',
    pattern: '^\\+[1-9][0-9]{6,14}$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9][0-9]{6,14}$/, {
    message: 'Phone number must be E.164 format with leading +',
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    example: '1985-06-15',
    description: 'Date de naissance (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'fr',
    description: 'Préférence de langue (ISO 639-1)',
  })
  @IsString()
  @IsOptional()
  languagePreference?: string;
}

export class CreatePersonDto extends PersonIdentityDto {
  @ApiProperty({ example: 1, description: 'Site propriétaire de la personne' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId: number;
}

export class UpdatePersonDto extends PartialType(PersonIdentityDto) {
  @ApiPropertyOptional({ description: 'Activer / désactiver la personne' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PersonFilterDto extends PaginationDto {
  @ApiProperty({ minimum: 1, example: 1, description: 'Site de recherche' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId: number;

  @ApiPropertyOptional({
    description: 'Recherche libre (nom, prénom, email, téléphone)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}

export class CreatePersonNoteDto {
  @ApiProperty({
    example: 'Client VIP – priorité maximale',
    description: 'Contenu de la note',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdatePersonNoteDto {
  @ApiProperty({
    example: 'Note mise à jour',
    description: 'Nouveau contenu de la note',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
