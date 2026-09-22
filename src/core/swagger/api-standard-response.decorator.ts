import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  StandardResponseDto,
  PaginatedResultDto,
  StandardErrorResponseDto,
} from './api-response.dto';

export interface ApiStandardResponseOptions {
  /**
   * Classe DTO du payload contenu dans `data`
   */
  type?: Type<any>;
  /**
   * Statut HTTP de la réponse (200 OK par défaut, ou 201 CREATED)
   */
  status?: HttpStatus;
  /**
   * Description textuelle de la réponse pour Swagger
   */
  description?: string;
  /**
   * Indique si la réponse est une liste paginée enveloppée dans `{ items, page, pageSize, total, totalPages }`
   */
  isPaginated?: boolean;
  /**
   * Indique si la réponse est un tableau brut d'éléments `T[]`
   */
  isArray?: boolean;
  /**
   * Pour les types primitifs quand `type` n'est pas un DTO de classe
   */
  primitiveType?: 'string' | 'number' | 'boolean' | 'object';
  /**
   * Exemple pour types primitifs
   */
  example?: any;
}

export function ApiStandardResponse(options: ApiStandardResponseOptions = {}) {
  const status = options.status || HttpStatus.OK;
  const description = options.description || 'Opération réussie';
  const extraModels: Type<any>[] = [StandardResponseDto];

  let dataSchema: any;

  if (options.type) {
    extraModels.push(options.type);

    if (options.isPaginated) {
      extraModels.push(PaginatedResultDto);
      dataSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: getSchemaPath(options.type) },
          },
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 25 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 2 },
        },
        required: ['items', 'page', 'pageSize', 'total', 'totalPages'],
      };
    } else if (options.isArray) {
      dataSchema = {
        type: 'array',
        items: { $ref: getSchemaPath(options.type) },
      };
    } else {
      dataSchema = {
        $ref: getSchemaPath(options.type),
      };
    }
  } else if (options.primitiveType) {
    dataSchema = {
      type: options.primitiveType,
      example: options.example !== undefined ? options.example : undefined,
    };
  } else {
    dataSchema = {
      type: 'object',
      nullable: true,
      example: options.example !== undefined ? options.example : null,
    };
  }

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(StandardResponseDto) },
          {
            properties: {
              data: dataSchema,
            },
            required: ['data'],
          },
        ],
      },
    }),
  );
}

export function ApiStandardErrorResponse(
  status: HttpStatus = HttpStatus.BAD_REQUEST,
  description?: string,
  codeExample = 'VALIDATION_ERROR',
) {
  return applyDecorators(
    ApiExtraModels(StandardErrorResponseDto),
    ApiResponse({
      status,
      description: description || `Erreur HTTP ${status}`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(StandardErrorResponseDto) },
          {
            properties: {
              code: { type: 'string', example: codeExample },
            },
          },
        ],
      },
    }),
  );
}
