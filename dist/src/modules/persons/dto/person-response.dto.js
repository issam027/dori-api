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
exports.PersonNoteResponseDto = exports.NoteAuthorDto = exports.PersonResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class PersonResponseDto {
    personId;
    firstName;
    lastName;
    email;
    phoneNumber;
    birthDate;
    languagePreference;
    isActive;
    createdAt;
    updatedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { personId: { required: true, type: () => Number }, firstName: { required: true, type: () => String }, lastName: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, phoneNumber: { required: true, type: () => String }, birthDate: { required: false, type: () => Date, nullable: true }, languagePreference: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date } };
    }
}
exports.PersonResponseDto = PersonResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PersonResponseDto.prototype, "personId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mohamed' }),
    __metadata("design:type", String)
], PersonResponseDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Trabelsi' }),
    __metadata("design:type", String)
], PersonResponseDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'mohamed.trabelsi@email.tn', nullable: true }),
    __metadata("design:type", Object)
], PersonResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+21698123456' }),
    __metadata("design:type", String)
], PersonResponseDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1985-05-12T00:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], PersonResponseDto.prototype, "birthDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], PersonResponseDto.prototype, "languagePreference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PersonResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], PersonResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], PersonResponseDto.prototype, "updatedAt", void 0);
class NoteAuthorDto {
    userId;
    username;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String } };
    }
}
exports.NoteAuthorDto = NoteAuthorDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], NoteAuthorDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'agent1' }),
    __metadata("design:type", String)
], NoteAuthorDto.prototype, "username", void 0);
class PersonNoteResponseDto {
    noteId;
    personId;
    content;
    isActive;
    createdByUser;
    updatedByUser;
    createdAt;
    updatedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { noteId: { required: true, type: () => Number }, personId: { required: true, type: () => Number }, content: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, createdByUser: { required: true, type: () => require("./person-response.dto").NoteAuthorDto }, updatedByUser: { required: false, type: () => require("./person-response.dto").NoteAuthorDto, nullable: true }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date } };
    }
}
exports.PersonNoteResponseDto = PersonNoteResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PersonNoteResponseDto.prototype, "noteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PersonNoteResponseDto.prototype, "personId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Client prioritaire à mobilité réduite.' }),
    __metadata("design:type", String)
], PersonNoteResponseDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PersonNoteResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NoteAuthorDto }),
    __metadata("design:type", NoteAuthorDto)
], PersonNoteResponseDto.prototype, "createdByUser", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: NoteAuthorDto, nullable: true }),
    __metadata("design:type", Object)
], PersonNoteResponseDto.prototype, "updatedByUser", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], PersonNoteResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], PersonNoteResponseDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=person-response.dto.js.map