import { ApiProperty } from '@nestjs/swagger';

export class StandardResponseDto<T> {
  @ApiProperty({ example: 'OK', description: "Code de statut applicatif ('OK' en cas de succès)" })
  code!: string;

  @ApiProperty({ example: null, nullable: true, description: 'Clé de traduction IHM (ou null)' })
  translationKey!: string | null;

  @ApiProperty({ example: {}, description: "Paramètres dynamiques de substitution pour la traduction" })
  translationParams!: Record<string, any>;

  // Le type réel de `data` est injecté via `allOf > properties` dans @ApiStandardResponse.
  // Le placeholder object ici évite que Swagger tente d'introspect le générique T
  // et génère une dépendance circulaire.
  @ApiProperty({ type: Object, nullable: true, example: null, description: "Payload de la réponse (type variable selon l'opération)" })
  data!: T;
}

export class PaginatedResultDto<T> {
  // Le type réel de `items` est injecté via le schema inline dans @ApiStandardResponse.
  // Le placeholder array of object évite la dépendance circulaire sur le générique T.
  @ApiProperty({ type: 'array', items: { type: 'object' }, description: "Éléments de la page courante" })
  items!: T[];

  @ApiProperty({ example: 1, description: 'Numéro de page courante' })
  page!: number;

  @ApiProperty({ example: 25, description: "Nombre d'éléments par page" })
  pageSize!: number;

  @ApiProperty({ example: 42, description: "Nombre total d'enregistrements correspondants" })
  total!: number;

  @ApiProperty({ example: 2, description: 'Nombre total de pages calculé' })
  totalPages!: number;
}

export class StandardErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: "Code standardisé de l'erreur applicative" })
  code!: string;

  @ApiProperty({ example: 'errors.validation_error', description: 'Clé de traduction pour message localisé' })
  translationKey!: string;

  @ApiProperty({ example: {}, description: "Paramètres contextuels de l'erreur" })
  translationParams!: Record<string, any>;

  @ApiProperty({ example: null, nullable: true, description: 'Détails techniques optionnels ou null' })
  data!: any;
}
