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
exports.UpdateRegistrationDto = exports.RescheduleAppointmentDto = exports.CreateRegistrationDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const person_dto_1 = require("../../persons/dto/person.dto");
class CreateRegistrationDto {
    personId;
    person;
    queueId;
    tierId;
    entryType = 'walkin';
    scheduledTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { personId: { required: false, type: () => Number }, person: { required: false, type: () => require("../../persons/dto/person.dto").CreatePersonDto }, queueId: { required: true, type: () => Number }, tierId: { required: true, type: () => Number }, entryType: { required: true, type: () => String, default: "walkin", enum: ['walkin', 'appointment'] }, scheduledTime: { required: false, type: () => String } };
    }
}
exports.CreateRegistrationDto = CreateRegistrationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ID de la personne si déjà existante' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateRegistrationDto.prototype, "personId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Création à la volée de la personne' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => person_dto_1.CreatePersonDto),
    __metadata("design:type", person_dto_1.CreatePersonDto)
], CreateRegistrationDto.prototype, "person", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 45 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateRegistrationDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Forfait de service obligatoire (défaut: free)' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateRegistrationDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['walkin', 'appointment'], default: 'walkin' }),
    (0, class_validator_1.IsIn)(['walkin', 'appointment']),
    __metadata("design:type", String)
], CreateRegistrationDto.prototype, "entryType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T11:00:00+01:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRegistrationDto.prototype, "scheduledTime", void 0);
class RescheduleAppointmentDto {
    scheduledTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { scheduledTime: { required: true, type: () => String } };
    }
}
exports.RescheduleAppointmentDto = RescheduleAppointmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-21T09:30:00+01:00' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RescheduleAppointmentDto.prototype, "scheduledTime", void 0);
class UpdateRegistrationDto {
    tierId;
    languagePreference;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: false, type: () => Number }, languagePreference: { required: false, type: () => String } };
    }
}
exports.UpdateRegistrationDto = UpdateRegistrationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateRegistrationDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRegistrationDto.prototype, "languagePreference", void 0);
//# sourceMappingURL=registration.dto.js.map