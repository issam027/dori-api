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
exports.UpdatePersonNoteDto = exports.CreatePersonNoteDto = exports.UpdatePersonDto = exports.CreatePersonDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreatePersonDto {
    firstName;
    lastName;
    email;
    phoneNumber;
    birthDate;
    languagePreference;
    static _OPENAPI_METADATA_FACTORY() {
        return { firstName: { required: false, type: () => String }, lastName: { required: false, type: () => String }, email: { required: false, type: () => String, format: "email" }, phoneNumber: { required: false, type: () => String, pattern: "^\\+[1-9][0-9]{6,14}$" }, birthDate: { required: false, type: () => String }, languagePreference: { required: false, type: () => String } };
    }
}
exports.CreatePersonDto = CreatePersonDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Amina' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Trabelsi' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'amina.trabelsi@example.com' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '+21650123456',
        description: 'Format E.164 avec le signe + obligatoire (§3.4)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\+[1-9][0-9]{6,14}$/, {
        message: 'Le numéro de téléphone doit respecter le format E.164 (ex: +21650123456)',
    }),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1990-05-15' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'fr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePersonDto.prototype, "languagePreference", void 0);
class UpdatePersonDto {
    firstName;
    lastName;
    email;
    phoneNumber;
    birthDate;
    languagePreference;
    static _OPENAPI_METADATA_FACTORY() {
        return { firstName: { required: false, type: () => String }, lastName: { required: false, type: () => String }, email: { required: false, type: () => String, format: "email" }, phoneNumber: { required: false, type: () => String, pattern: "^\\+[1-9][0-9]{6,14}$" }, birthDate: { required: false, type: () => String }, languagePreference: { required: false, type: () => String } };
    }
}
exports.UpdatePersonDto = UpdatePersonDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\+[1-9][0-9]{6,14}$/),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePersonDto.prototype, "languagePreference", void 0);
class CreatePersonNoteDto {
    content;
    static _OPENAPI_METADATA_FACTORY() {
        return { content: { required: true, type: () => String } };
    }
}
exports.CreatePersonNoteDto = CreatePersonNoteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Allergique aux fraises, se déplace en fauteuil roulant' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePersonNoteDto.prototype, "content", void 0);
class UpdatePersonNoteDto {
    content;
    static _OPENAPI_METADATA_FACTORY() {
        return { content: { required: true, type: () => String } };
    }
}
exports.UpdatePersonNoteDto = UpdatePersonNoteDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdatePersonNoteDto.prototype, "content", void 0);
//# sourceMappingURL=person.dto.js.map