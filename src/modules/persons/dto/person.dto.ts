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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class PersonIdentityDto {
  @ApiPropertyOptional({ example: 'Mohamed', description: 'Prénom' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Ben Ali', description: 'Nom de famille' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    example: 'mohamed.benali@example.tn',
    description: 'Adresse e-mail',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: '+21698765432',
    description: 'Numéro de téléphone au format E.164',
    pattern: '^\\+[1-9][0-9]{6,14}$',
  })
  @Matches(/^\+[1-9][0-9]{6,14}$/, {
    message: 'Phone number must be E.164 format with leading +',
  })
  @IsOptional()
  phoneNumber?: string;

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

export class UpdatePersonDto extends PersonIdentityDto {
  @ApiPropertyOptional({ description: 'Activer / désactiver la personne' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PersonFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Recherche libre (nom, prénom, email, téléphone)',
  })
  @IsString()
  @IsOptional()
  search?: string;
}

export class CreateNoteDto {
  @ApiProperty({
    example: 'Client VIP – priorité maximale',
    description: 'Contenu de la note',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateNoteDto {
  @ApiProperty({
    example: 'Note mise à jour',
    description: 'Nouveau contenu de la note',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
