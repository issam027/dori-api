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
exports.UpdateTranslationDto = exports.CreateTranslationDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateTranslationDto {
    translationKey;
    category = 'ihm';
    locale;
    content;
    expectedParams;
    static _OPENAPI_METADATA_FACTORY() {
        return { translationKey: { required: true, type: () => String }, category: { required: true, type: () => String, default: "ihm", enum: ['ihm', 'sms', 'error'] }, locale: { required: true, type: () => String }, content: { required: true, type: () => String }, expectedParams: { required: false, type: () => [String] } };
    }
}
exports.CreateTranslationDto = CreateTranslationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ihm.queue.position_update' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTranslationDto.prototype, "translationKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['ihm', 'sms', 'error'], default: 'ihm' }),
    (0, class_validator_1.IsIn)(['ihm', 'sms', 'error']),
    __metadata("design:type", String)
], CreateTranslationDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTranslationDto.prototype, "locale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Vous êtes en {position}ᵉ position, environ {minutes} min' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTranslationDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['position', 'minutes'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateTranslationDto.prototype, "expectedParams", void 0);
class UpdateTranslationDto {
    content;
    expectedParams;
    static _OPENAPI_METADATA_FACTORY() {
        return { content: { required: false, type: () => String }, expectedParams: { required: false, type: () => [String] } };
    }
}
exports.UpdateTranslationDto = UpdateTranslationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateTranslationDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateTranslationDto.prototype, "expectedParams", void 0);
//# sourceMappingURL=translation.dto.js.map