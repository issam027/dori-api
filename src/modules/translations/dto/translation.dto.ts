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
import { Transform } from 'class-transformer';
import { strictBoolean } from '../../../core/validation/strict-boolean.transformer';

export class CreateTranslationDto {
  @ApiProperty({
    example: 'queue.ticket.your_turn',
    description: 'Clé unique de traduction',
  })
  @IsString()
  @IsNotEmpty()
  translationKey: string;

  @ApiProperty({
    enum: ['ihm', 'sms', 'email', 'error'],
    example: 'ihm',
    description: "Catégorie d'usage",
  })
  @IsIn(['ihm', 'sms', 'email', 'error'])
  @IsNotEmpty()
  category: 'ihm' | 'sms' | 'email' | 'error';

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
  @ApiPropertyOptional({ type: Boolean, default: true })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
  @ApiPropertyOptional({
    enum: ['ihm', 'sms', 'email', 'error'],
    description: 'Filtrer par catégorie',
  })
  @IsIn(['ihm', 'sms', 'email', 'error'])
  @IsOptional()
  category?: 'ihm' | 'sms' | 'email' | 'error';

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
  @ApiPropertyOptional({ type: Boolean, default: true })
  @Transform(({ obj, key }) => strictBoolean(obj[key]))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
  @ApiProperty({ example: 'fr', description: 'Locale demandée pour le bundle' })
  @IsString()
  @IsNotEmpty()
  locale: string;

  @ApiPropertyOptional({
    enum: ['ihm', 'sms', 'email', 'error'],
    description: 'Catégorie optionnelle pour filtrer le bundle',
  })
  @IsIn(['ihm', 'sms', 'email', 'error'])
  @IsOptional()
  category?: 'ihm' | 'sms' | 'email' | 'error';
}
