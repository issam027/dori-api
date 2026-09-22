"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardErrorResponseDto = exports.PaginatedResultDto = exports.StandardResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class StandardResponseDto {
    code;
    translationKey;
    translationParams;
    data;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String }, translationKey: { required: true, type: () => String, nullable: true }, translationParams: { required: true, type: "object", additionalProperties: true }, data: { required: true } };
    }
}
exports.StandardResponseDto = StandardResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OK', description: "Code de statut applicatif ('OK' en cas de succès)" }),
    __metadata("design:type", String)
], StandardResponseDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: null, nullable: true, description: 'Clé de traduction IHM (ou null)' }),
    __metadata("design:type", Object)
], StandardResponseDto.prototype, "translationKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: {}, description: "Paramètres dynamiques de substitution pour la traduction" }),
    __metadata("design:type", Object)
], StandardResponseDto.prototype, "translationParams", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: Object, nullable: true, example: null, description: "Payload de la réponse (type variable selon l'opération)" }),
    __metadata("design:type", Object)
], StandardResponseDto.prototype, "data", void 0);
class PaginatedResultDto {
    items;
    page;
    pageSize;
    total;
    totalPages;
    static _OPENAPI_METADATA_FACTORY() {
        return { items: { required: true }, page: { required: true, type: () => Number }, pageSize: { required: true, type: () => Number }, total: { required: true, type: () => Number }, totalPages: { required: true, type: () => Number } };
    }
}
exports.PaginatedResultDto = PaginatedResultDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'array', items: { type: 'object' }, description: "Éléments de la page courante" }),
    __metadata("design:type", Array)
], PaginatedResultDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Numéro de page courante' }),
    __metadata("design:type", Number)
], PaginatedResultDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25, description: "Nombre d'éléments par page" }),
    __metadata("design:type", Number)
], PaginatedResultDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 42, description: "Nombre total d'enregistrements correspondants" }),
    __metadata("design:type", Number)
], PaginatedResultDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Nombre total de pages calculé' }),
    __metadata("design:type", Number)
], PaginatedResultDto.prototype, "totalPages", void 0);
class StandardErrorResponseDto {
    code;
    translationKey;
    translationParams;
    data;
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String }, translationKey: { required: true, type: () => String }, translationParams: { required: true, type: "object", additionalProperties: true }, data: { required: true, type: () => Object } };
    }
}
exports.StandardErrorResponseDto = StandardErrorResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VALIDATION_ERROR', description: "Code standardisé de l'erreur applicative" }),
    __metadata("design:type", String)
], StandardErrorResponseDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'errors.validation_error', description: 'Clé de traduction pour message localisé' }),
    __metadata("design:type", String)
], StandardErrorResponseDto.prototype, "translationKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: {}, description: "Paramètres contextuels de l'erreur" }),
    __metadata("design:type", Object)
], StandardErrorResponseDto.prototype, "translationParams", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: null, nullable: true, description: 'Détails techniques optionnels ou null' }),
    __metadata("design:type", Object)
], StandardErrorResponseDto.prototype, "data", void 0);
//# sourceMappingURL=api-response.dto.js.map