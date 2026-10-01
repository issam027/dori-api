import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

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
 *   @ApiDoriOkResponse(NotificationDetailDto)
 *   @ApiDoriOkResponse([NotificationDetailDto])          // array
 *   @ApiDoriOkResponse(PaginatedNotificationResponseDto) // paginated
 */
export function ApiDoriOkResponse<T extends Type<unknown>>(
  dto: T | [T],
  description = 'Succès',
) {
  const isArray = Array.isArray(dto);
  const dtoClass = isArray ? (dto as [T])[0] : (dto as T);

  const dataSchema: Record<string, unknown> = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(dtoClass) } }
    : { $ref: getSchemaPath(dtoClass) };

  return applyDecorators(
    ApiExtraModels(dtoClass),
    ApiOkResponse({
      description,
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
  const dataSchema: Record<string, unknown> = { $ref: getSchemaPath(dto) };

  return applyDecorators(
    ApiExtraModels(dto),
    ApiCreatedResponse({
      description,
      schema: buildEnvelopeSchema(dataSchema),
    }),
  );
}
