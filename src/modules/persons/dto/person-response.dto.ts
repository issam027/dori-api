import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../core/pagination/pagination.dto';

export class PersonResponseDto {
  @ApiProperty({ example: 45, description: 'ID de la personne' })
  personId: number;

  @ApiProperty({ example: 1, description: 'Site propriétaire de la personne' })
  siteId: number;

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

export class PaginatedPersonResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [PersonResponseDto], description: 'Personnes trouvées' })
  items: PersonResponseDto[];

  @ApiProperty({ example: 1, description: 'Page' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille' })
  pageSize: number;

  @ApiProperty({ example: 1, description: 'Total' })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class PersonNoteResponseDto {
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

  @ApiPropertyOptional({
    example: 'jdupont',
    description: "Identifiant de l'auteur de la note",
  })
  authorUsername?: string;

  @ApiProperty({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de création',
  })
  createdAt: string;

  @ApiPropertyOptional({
    example: '2026-09-27T10:00:00.000Z',
    description: 'Date de dernière modification',
  })
  updatedAt?: string;
}

export class PaginatedPersonNoteResponseDto extends PaginatedResponseDto {
  @ApiProperty({
    type: [PersonNoteResponseDto],
    description: 'Liste paginée des notes de la personne',
  })
  items: PersonNoteResponseDto[];

  @ApiProperty({ example: 1, description: 'Page actuelle' })
  page: number;

  @ApiProperty({ example: 25, description: 'Taille de page' })
  pageSize: number;

  @ApiProperty({ example: 1, description: "Total d'éléments" })
  total: number;

  @ApiProperty({ example: 1, description: 'Total de pages' })
  totalPages: number;
}

export class DeleteItemResponseDto {
  @ApiProperty({ example: 5, description: "ID de l'élément supprimé" })
  id: number;

  @ApiProperty({ example: true, description: 'Confirmation de suppression' })
  deleted: boolean;
}
