import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonDetailDto {
  @ApiProperty({ example: 45, description: 'ID de la personne' })
  personId: number;

  @ApiProperty({ example: 'Ben Ali', description: 'Nom de famille' })
  lastName: string;

  @ApiProperty({ example: 'Mohamed', description: 'Prénom' })
  firstName: string;

  @ApiPropertyOptional({
    example: '+21698123456',
    description: 'Numéro de téléphone',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'mohamed.benali@example.tn',
    description: 'Adresse email',
  })
  email?: string;

  @ApiPropertyOptional({
    example: '1985-06-15',
    description: 'Date de naissance',
  })
  birthDate?: string;

  @ApiProperty({ example: 'fr', description: 'Langue préférée' })
  preferredLanguage: string;

  @ApiProperty({ example: true, description: 'Personne active' })
  isActive: boolean;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;
}

export class PaginatedPersonResponseDto {
  @ApiProperty({ type: [PersonDetailDto], description: 'Personnes trouvées' })
  items: PersonDetailDto[];

  @ApiProperty({ example: 1, description: 'Page' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille' })
  pageSize: number;

  @ApiProperty({ example: 1, description: 'Total' })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class PersonNoteDetailDto {
  @ApiProperty({ example: 5, description: 'ID de la note' })
  noteId: number;

  @ApiProperty({ example: 45, description: 'ID de la personne' })
  personId: number;

  @ApiProperty({
    example: 'Patient nécessitant un accompagnateur pour les déplacements',
    description: 'Contenu de la note',
  })
  content: string;

  @ApiProperty({ example: 1, description: "ID de l'auteur de la note" })
  createdByUserId: number;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;
}

export class PersonDeleteResponseDto {
  @ApiProperty({ example: 5, description: "ID de l'élément supprimé" })
  id: number;

  @ApiProperty({ example: true, description: 'Confirmation de suppression' })
  deleted: boolean;
}
