import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class TranslationDetailDto {
  @ApiProperty({ example: 1, description: 'ID unique de la traduction' })
  translationId: number;

  @ApiProperty({
    example: 'queue.ticket.your_turn',
    description: 'Clé de traduction',
  })
  translationKey: string;

  @ApiProperty({
    example: 'ihm',
    enum: ['ihm', 'sms', 'error'],
    description: "Catégorie d'usage",
  })
  category: string;

  @ApiProperty({ example: 'fr', description: 'Code de locale' })
  locale: string;

  @ApiProperty({
    example: "C'est votre tour au guichet {counterNumber} !",
    description: 'Contenu traduit',
  })
  content: string;

  @ApiPropertyOptional({
    example: ['counterNumber'],
    type: [String],
    description: 'Paramètres attendus dans le gabarit',
  })
  expectedParams?: string[];

  @ApiProperty({ example: true, description: 'Statut actif de la traduction' })
  isActive: boolean;

  @ApiProperty({
    example: '2026-09-01T08:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-09-28T14:30:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt: string;
}

export class PaginatedTranslationResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [TranslationDetailDto],
    description: 'Liste des traductions',
  })
  items: TranslationDetailDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize: number;

  @ApiProperty({ example: 15, description: "Nombre total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Nombre total de pages' })
  totalPages: number;
}

export class TranslationBundleResponseDto {
  @ApiProperty({ example: 'fr', description: 'Locale du bundle' })
  locale: string;

  @ApiProperty({ example: 'ihm', description: 'Catégorie du bundle' })
  category: string;

  @ApiProperty({
    example: 3,
    description: 'Numéro de version du bundle de traduction',
  })
  version: number;

  @ApiProperty({
    example: {
      'queue.ticket.your_turn': "C'est votre tour au guichet {counterNumber} !",
      'welcome.message': 'Bienvenue à la clinique',
    },
    description:
      'Dictionnaire clé-valeur des traductions pour la locale et la catégorie',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  entries: Record<string, string>;
}

export class DeleteTranslationResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la traduction supprimée' })
  translationId: number;

  @ApiProperty({ example: true, description: 'Confirmation de la suppression' })
  deleted: boolean;
}
