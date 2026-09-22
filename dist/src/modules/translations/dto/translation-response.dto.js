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
exports.TranslationResponseDto = exports.TranslationBundleResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class TranslationBundleResponseDto {
    locale;
    category;
    version;
    entries;
    static _OPENAPI_METADATA_FACTORY() {
        return { locale: { required: true, type: () => String }, category: { required: true, type: () => String }, version: { required: true, type: () => Number }, entries: { required: true, type: "object", additionalProperties: { type: "string" } } };
    }
}
exports.TranslationBundleResponseDto = TranslationBundleResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], TranslationBundleResponseDto.prototype, "locale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ihm' }),
    __metadata("design:type", String)
], TranslationBundleResponseDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 4, description: 'Version incrémentale du cache bundle' }),
    __metadata("design:type", Number)
], TranslationBundleResponseDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            'button.submit': 'Valider',
            'label.welcome': 'Bienvenue chez DORI-TN',
        },
        description: 'Dictionnaire clé/valeur des traductions',
    }),
    __metadata("design:type", Object)
], TranslationBundleResponseDto.prototype, "entries", void 0);
class TranslationResponseDto {
    translationId;
    translationKey;
    locale;
    content;
    expectedParams;
    category;
    isActive;
    createdAt;
    updatedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { translationId: { required: true, type: () => Number }, translationKey: { required: true, type: () => String }, locale: { required: true, type: () => String }, content: { required: true, type: () => String }, expectedParams: { required: false, type: () => [String], nullable: true }, category: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date } };
    }
}
exports.TranslationResponseDto = TranslationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], TranslationResponseDto.prototype, "translationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'welcome.message' }),
    __metadata("design:type", String)
], TranslationResponseDto.prototype, "translationKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], TranslationResponseDto.prototype, "locale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bienvenue {name} !' }),
    __metadata("design:type", String)
], TranslationResponseDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['name'], isArray: true, nullable: true }),
    __metadata("design:type", Object)
], TranslationResponseDto.prototype, "expectedParams", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ihm', enum: ['ihm', 'notification', 'error'] }),
    __metadata("design:type", String)
], TranslationResponseDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], TranslationResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], TranslationResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], TranslationResponseDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=translation-response.dto.js.map