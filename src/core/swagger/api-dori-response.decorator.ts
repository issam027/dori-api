import { applyDecorators, SetMetadata, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

export const SERIALIZATION_DTO_KEY = 'dori:serialization-dto';

const PUBLIC_RESPONSE_DTO_NAME = /(?:Response|Item)Dto$/;

/**
 * Public OpenAPI response schemas follow one global convention:
 * - ResourceResponseDto
 * - PaginatedResourceResponseDto
 * - ActionResourceResponseDto
 * - ConceptItemDto for an item returned inside an array
 */
export function assertPublicResponseDtoName(dto: Type<unknown>): void {
  if (!PUBLIC_RESPONSE_DTO_NAME.test(dto.name)) {
    throw new Error(
      `Invalid public response DTO name "${dto.name}". ` +
        'Use ResourceResponseDto, PaginatedResourceResponseDto, ' +
        'ActionResourceResponseDto or ConceptItemDto.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ErrorResponseDto : forme exacte produite par GlobalExceptionFilter
// ─────────────────────────────────────────────────────────────────────────────
export class ErrorResponseDto {
  @ApiProperty({
    example: 'USER_NOT_FOUND',
    description: "Code applicatif de l'erreur (voir catalogue des erreurs)",
  })
  code: string;

  @ApiProperty({
    example: 'errors.user_not_found',
    nullable: true,
    description: 'Clé de traduction i18n du message',
  })
  translationKey: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { userId: 42 },
    description: 'Paramètres de traduction injectés dans le message',
  })
  translationParams: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Données contextuelles de l'erreur (ex: liste de champs invalides)",
    example: { errors: ['username must not be empty'] },
  })
  data: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma inline pour les réponses d'erreur (référence ErrorResponseDto)
// ─────────────────────────────────────────────────────────────────────────────
function errorSchema() {
  return { $ref: getSchemaPath(ErrorResponseDto) };
}

/**
 * @ApiDoriErrorResponses — ajoute les réponses d'erreur standard sur un endpoint authentifié.
 *
 * Codes couverts : 400 · 401 · 403 · 404 · 409 · 422 · 423 · 429
 *
 * @example
 *   @ApiDoriErrorResponses()                   // 400+401+403+404+409+422+423+429
 *   @ApiDoriErrorResponses({ omit404: true })  // sans 404
 */
export function ApiDoriErrorResponses(
  opts: {
    omit401?: boolean;
    omit403?: boolean;
    omit404?: boolean;
    omit409?: boolean;
    omit422?: boolean;
  } = {},
) {
  opts.omit404 ??= true;
  opts.omit409 ??= true;
  opts.omit422 ??= true;
  const decorators: MethodDecorator[] = [ApiExtraModels(ErrorResponseDto)];

  decorators.push(
    ApiResponse({
      status: 400,
      description: 'Données invalides (validation échouée)',
      schema: errorSchema(),
    }),
  );

  if (!opts.omit401) {
    decorators.push(
      ApiResponse({
        status: 401,
        description: 'Non authentifié — token manquant ou expiré',
        schema: errorSchema(),
      }),
    );
  }

  if (!opts.omit403) {
    decorators.push(
      ApiResponse({
        status: 403,
        description: 'Accès interdit — permission insuffisante',
        schema: errorSchema(),
      }),
    );
  }

  if (!opts.omit404) {
    decorators.push(
      ApiResponse({
        status: 404,
        description: 'Ressource introuvable',
        schema: errorSchema(),
      }),
    );
  }

  if (!opts.omit409) {
    decorators.push(
      ApiResponse({
        status: 409,
        description: 'Conflit métier (doublon, slot plein, compte verrouillé…)',
        schema: errorSchema(),
      }),
    );
  }

  if (!opts.omit422) {
    decorators.push(
      ApiResponse({
        status: 422,
        description: 'Entité non traitable — règle métier enfreinte',
        schema: errorSchema(),
      }),
    );
  }

  decorators.push(
    ApiResponse({
      status: 429,
      description: 'Trop de requêtes — limite de débit atteinte',
      schema: errorSchema(),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur interne sans exposition de détails techniques',
      schema: errorSchema(),
    }),
  );

  return applyDecorators(...decorators);
}

/**
 * @ApiDoriPublicErrorResponses — variante pour les endpoints publics (sans 401/403).
 */
export function ApiDoriPublicErrorResponses(
  opts: {
    include401?: boolean;
    omit404?: boolean;
    omit409?: boolean;
    omit422?: boolean;
  } = {},
) {
  return ApiDoriErrorResponses({
    omit401: !opts.include401,
    omit403: true,
    omit404: opts.omit404,
    omit409: opts.omit409,
    omit422: opts.omit422,
  });
}

/**
 * Documents an intentionally unwrapped HTTP response such as health checks
 * and redirects. Standard API success payloads must use ApiDoriOkResponse or
 * ApiDoriCreatedResponse instead.
 */
export function ApiDoriRawResponse<T extends Type<unknown>>(
  status: number,
  description: string,
  dto?: T,
  example?: unknown,
) {
  const decorators: MethodDecorator[] = [];

  if (dto) {
    assertPublicResponseDtoName(dto);
    decorators.push(ApiExtraModels(dto));
  }

  decorators.push(
    ApiResponse({
      status,
      description,
      ...(dto ? { type: dto } : {}),
      ...(example
        ? {
            content: {
              'application/json': { example },
            },
          }
        : {}),
    }),
  );

  return applyDecorators(...decorators);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers pour les réponses de succès (inchangés)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the wrapped StandardResponse<T> schema for Swagger.
 * Matches the runtime envelope from ResponseInterceptor:
 *   { code, translationKey, translationParams, data }
 */
function buildEnvelopeSchema(dataSchema: Record<string, unknown>) {
  return {
    properties: {
      code: {
        type: 'string',
        example: 'OK',
        description: 'Code applicatif du résultat',
      },
      translationKey: {
        type: 'string',
        nullable: true,
        example: null,
        description: 'Clé de traduction du message (null si aucun message)',
      },
      translationParams: {
        type: 'object',
        additionalProperties: true,
        example: {},
        description: 'Paramètres de traduction',
      },
      data: dataSchema,
    },
    required: ['code', 'translationKey', 'translationParams', 'data'],
  };
}

/**
 * @ApiDoriOkResponse — wraps a DTO in the StandardResponse envelope for accurate Swagger docs.
 * Use instead of @ApiOkResponse to correctly document the actual runtime response shape.
 *
 * @example
 *   @ApiDoriOkResponse(NotificationResponseDto)
 *   @ApiDoriOkResponse([NotificationResponseDto])          // array
 *   @ApiDoriOkResponse(PaginatedNotificationResponseDto) // paginated
 */
export function ApiDoriOkResponse<T extends Type<unknown>>(
  dto: T | [T],
  description = 'Succès',
  headers?: Record<string, { description: string; schema: { type: string } }>,
) {
  const isArray = Array.isArray(dto);
  const dtoClass = isArray ? (dto as [T])[0] : (dto as T);
  assertPublicResponseDtoName(dtoClass);

  const dataSchema: Record<string, unknown> = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(dtoClass) } }
    : { $ref: getSchemaPath(dtoClass) };

  return applyDecorators(
    SetMetadata(SERIALIZATION_DTO_KEY, { dto: dtoClass, isArray }),
    ApiExtraModels(dtoClass),
    ApiOkResponse({
      description,
      headers,
      schema: buildEnvelopeSchema(dataSchema),
    }),
  );
}

/**
 * @ApiDoriCreatedResponse — wraps a DTO in the StandardResponse envelope for Swagger docs.
 * Use instead of @ApiCreatedResponse.
 */
export function ApiDoriCreatedResponse<T extends Type<unknown>>(
  dto: T,
  description = 'Créé avec succès',
) {
  assertPublicResponseDtoName(dto);
  const dataSchema: Record<string, unknown> = { $ref: getSchemaPath(dto) };

  return applyDecorators(
    SetMetadata(SERIALIZATION_DTO_KEY, { dto, isArray: false }),
    ApiExtraModels(dto),
    ApiCreatedResponse({
      description,
      schema: buildEnvelopeSchema(dataSchema),
    }),
  );
}
