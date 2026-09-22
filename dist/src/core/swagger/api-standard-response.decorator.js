"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiStandardResponse = ApiStandardResponse;
exports.ApiStandardErrorResponse = ApiStandardErrorResponse;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_response_dto_1 = require("./api-response.dto");
function ApiStandardResponse(options = {}) {
    const status = options.status || common_1.HttpStatus.OK;
    const description = options.description || 'Opération réussie';
    const extraModels = [api_response_dto_1.StandardResponseDto];
    let dataSchema;
    if (options.type) {
        extraModels.push(options.type);
        if (options.isPaginated) {
            extraModels.push(api_response_dto_1.PaginatedResultDto);
            dataSchema = {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: { $ref: (0, swagger_1.getSchemaPath)(options.type) },
                    },
                    page: { type: 'integer', example: 1 },
                    pageSize: { type: 'integer', example: 25 },
                    total: { type: 'integer', example: 42 },
                    totalPages: { type: 'integer', example: 2 },
                },
                required: ['items', 'page', 'pageSize', 'total', 'totalPages'],
            };
        }
        else if (options.isArray) {
            dataSchema = {
                type: 'array',
                items: { $ref: (0, swagger_1.getSchemaPath)(options.type) },
            };
        }
        else {
            dataSchema = {
                $ref: (0, swagger_1.getSchemaPath)(options.type),
            };
        }
    }
    else if (options.primitiveType) {
        dataSchema = {
            type: options.primitiveType,
            example: options.example !== undefined ? options.example : undefined,
        };
    }
    else {
        dataSchema = {
            type: 'object',
            nullable: true,
            example: options.example !== undefined ? options.example : null,
        };
    }
    return (0, common_1.applyDecorators)((0, swagger_1.ApiExtraModels)(...extraModels), (0, swagger_1.ApiResponse)({
        status,
        description,
        schema: {
            allOf: [
                { $ref: (0, swagger_1.getSchemaPath)(api_response_dto_1.StandardResponseDto) },
                {
                    properties: {
                        data: dataSchema,
                    },
                    required: ['data'],
                },
            ],
        },
    }));
}
function ApiStandardErrorResponse(status = common_1.HttpStatus.BAD_REQUEST, description, codeExample = 'VALIDATION_ERROR') {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiExtraModels)(api_response_dto_1.StandardErrorResponseDto), (0, swagger_1.ApiResponse)({
        status,
        description: description || `Erreur HTTP ${status}`,
        schema: {
            allOf: [
                { $ref: (0, swagger_1.getSchemaPath)(api_response_dto_1.StandardErrorResponseDto) },
                {
                    properties: {
                        code: { type: 'string', example: codeExample },
                    },
                },
            ],
        },
    }));
}
//# sourceMappingURL=api-standard-response.decorator.js.map