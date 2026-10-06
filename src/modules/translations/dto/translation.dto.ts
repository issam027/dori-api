import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../core/pagination/pagination.dto';

export class CreateTranslationDto {
  @ApiProperty({
    example: 'queue.ticket.your_turn',
    description: 'Clé unique de traduction',
  })
  @IsString()
  @IsNotEmpty()
  translationKey: string;

  @ApiProperty({
    enum: ['ihm', 'sms', 'error'],
    example: 'ihm',
    description: "Catégorie d'usage",
  })
  @IsIn(['ihm', 'sms', 'error'])
  @IsNotEmpty()
  category: 'ihm' | 'sms' | 'error';

  @ApiProperty({
    example: 'fr',
    description: 'Code de locale (ISO 639-1 ou IETF)',
  })
  @IsString()
  @IsNotEmpty()
  locale: string;

  @ApiProperty({
    example: "C'est votre tour au guichet {counterNumber} !",
    description: 'Contenu traduit avec placeholders éventuels',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    example: ['counterNumber'],
    type: [String],
    description: 'Liste des paramètres attendus dans le gabarit',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expectedParams?: string[];
}

export class UpdateTranslationDto {
  @ApiPropertyOptional({
    example: 'Nouveau texte traduit...',
    description: 'Nouveau contenu de traduction',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    example: ['counterNumber'],
    type: [String],
    description: 'Liste des paramètres attendus',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expectedParams?: string[];

  @ApiPropertyOptional({ description: 'Statut actif / inactif' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class TranslationFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['ihm', 'sms', 'error'],
    description: 'Filtrer par catégorie',
  })
  @IsIn(['ihm', 'sms', 'error'])
  @IsOptional()
  category?: 'ihm' | 'sms' | 'error';

  @ApiPropertyOptional({ example: 'fr', description: 'Filtrer par locale' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({
    example: 'queue.',
    description: 'Recherche textuelle sur la clé',
  })
  @IsString()
  @IsOptional()
  key?: string;
}

export class TranslationBundleQueryDto {
  @ApiProperty({ example: 'fr', description: 'Locale demandée pour le bundle' })
  @IsString()
  @IsNotEmpty()
  locale: string;

  @ApiPropertyOptional({
    enum: ['ihm', 'sms', 'error'],
    description: 'Catégorie optionnelle pour filtrer le bundle',
  })
  @IsIn(['ihm', 'sms', 'error'])
  @IsOptional()
  category?: 'ihm' | 'sms' | 'error';
}
