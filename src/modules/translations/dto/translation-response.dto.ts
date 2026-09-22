import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranslationBundleResponseDto {
  @ApiProperty({ example: 'fr' })
  locale!: string;

  @ApiProperty({ example: 'ihm' })
  category!: string;

  @ApiProperty({ example: 4, description: 'Version incrémentale du cache bundle' })
  version!: number;

  @ApiProperty({
    example: {
      'button.submit': 'Valider',
      'label.welcome': 'Bienvenue chez DORI-TN',
    },
    description: 'Dictionnaire clé/valeur des traductions',
  })
  entries!: Record<string, string>;
}

export class TranslationResponseDto {
  @ApiProperty({ example: 1 })
  translationId!: number;

  @ApiProperty({ example: 'welcome.message' })
  translationKey!: string;

  @ApiProperty({ example: 'fr' })
  locale!: string;

  @ApiProperty({ example: 'Bienvenue {name} !' })
  content!: string;

  @ApiPropertyOptional({ example: ['name'], isArray: true, nullable: true })
  expectedParams?: string[] | null;

  @ApiProperty({ example: 'ihm', enum: ['ihm', 'notification', 'error'] })
  category!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  updatedAt!: Date;
}
