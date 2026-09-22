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
exports.CompleteRegistrationResponseDto = exports.CallNextResponseDto = exports.CalledTierDto = exports.CalledPersonDto = exports.OpenSessionResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class OpenSessionResponseDto {
    sessionId;
    queueId;
    userId;
    threadNumber;
    mode;
    connectedAt;
    takenOverFromSessionId;
    reassignedRegistrationId;
    static _OPENAPI_METADATA_FACTORY() {
        return { sessionId: { required: true, type: () => Number }, queueId: { required: true, type: () => Number }, userId: { required: true, type: () => Number }, threadNumber: { required: false, type: () => Number, nullable: true }, mode: { required: true, type: () => String }, connectedAt: { required: true, type: () => String }, takenOverFromSessionId: { required: false, type: () => Number, nullable: true }, reassignedRegistrationId: { required: false, type: () => Number, nullable: true } };
    }
}
exports.OpenSessionResponseDto = OpenSessionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12 }),
    __metadata("design:type", Number)
], OpenSessionResponseDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], OpenSessionResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], OpenSessionResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, nullable: true, description: 'Numéro de guichet physique ou null en mode consultation' }),
    __metadata("design:type", Object)
], OpenSessionResponseDto.prototype, "threadNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'active', enum: ['active', 'consultation_only'] }),
    __metadata("design:type", String)
], OpenSessionResponseDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", String)
], OpenSessionResponseDto.prototype, "connectedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10, nullable: true }),
    __metadata("design:type", Object)
], OpenSessionResponseDto.prototype, "takenOverFromSessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 101, nullable: true }),
    __metadata("design:type", Object)
], OpenSessionResponseDto.prototype, "reassignedRegistrationId", void 0);
class CalledPersonDto {
    personId;
    firstName;
    lastName;
    phone;
    hasNotes;
    static _OPENAPI_METADATA_FACTORY() {
        return { personId: { required: true, type: () => Number }, firstName: { required: true, type: () => String }, lastName: { required: true, type: () => String }, phone: { required: true, type: () => String }, hasNotes: { required: true, type: () => Boolean } };
    }
}
exports.CalledPersonDto = CalledPersonDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], CalledPersonDto.prototype, "personId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mohamed' }),
    __metadata("design:type", String)
], CalledPersonDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Trabelsi' }),
    __metadata("design:type", String)
], CalledPersonDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+21698123456' }),
    __metadata("design:type", String)
], CalledPersonDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Indique si le client possède des notes internes actives' }),
    __metadata("design:type", Boolean)
], CalledPersonDto.prototype, "hasNotes", void 0);
class CalledTierDto {
    tierId;
    tierCode;
    tierName;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, tierCode: { required: true, type: () => String }, tierName: { required: true, type: () => String } };
    }
}
exports.CalledTierDto = CalledTierDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], CalledTierDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'free' }),
    __metadata("design:type", String)
], CalledTierDto.prototype, "tierCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Gratuit / Standard' }),
    __metadata("design:type", String)
], CalledTierDto.prototype, "tierName", void 0);
class CallNextResponseDto {
    registrationId;
    ticketNumber;
    entryType;
    scheduledTime;
    calledEarly;
    tier;
    status;
    sessionId;
    threadNumber;
    priorityScore;
    calledAt;
    person;
    static _OPENAPI_METADATA_FACTORY() {
        return { registrationId: { required: true, type: () => Number }, ticketNumber: { required: true, type: () => String }, entryType: { required: true, type: () => String }, scheduledTime: { required: false, type: () => String, nullable: true }, calledEarly: { required: true, type: () => Boolean }, tier: { required: true, type: () => require("./queue-engine-response.dto").CalledTierDto }, status: { required: true, type: () => String }, sessionId: { required: true, type: () => Number }, threadNumber: { required: false, type: () => Number, nullable: true }, priorityScore: { required: true, type: () => Number }, calledAt: { required: false, type: () => String, nullable: true }, person: { required: true, type: () => require("./queue-engine-response.dto").CalledPersonDto } };
    }
}
exports.CallNextResponseDto = CallNextResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], CallNextResponseDto.prototype, "registrationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED001' }),
    __metadata("design:type", String)
], CallNextResponseDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'walkin', enum: ['walkin', 'appointment'] }),
    __metadata("design:type", String)
], CallNextResponseDto.prototype, "entryType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], CallNextResponseDto.prototype, "scheduledTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Vrai si appelé en avance pour éviter l’inactivité du guichet' }),
    __metadata("design:type", Boolean)
], CallNextResponseDto.prototype, "calledEarly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CalledTierDto }),
    __metadata("design:type", CalledTierDto)
], CallNextResponseDto.prototype, "tier", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'in_progress' }),
    __metadata("design:type", String)
], CallNextResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12 }),
    __metadata("design:type", Number)
], CallNextResponseDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, nullable: true }),
    __metadata("design:type", Object)
], CallNextResponseDto.prototype, "threadNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 45.2, description: 'Score de priorité dynamique calculé (§4.4)' }),
    __metadata("design:type", Number)
], CallNextResponseDto.prototype, "priorityScore", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T09:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], CallNextResponseDto.prototype, "calledAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CalledPersonDto }),
    __metadata("design:type", CalledPersonDto)
], CallNextResponseDto.prototype, "person", void 0);
class CompleteRegistrationResponseDto {
    registrationId;
    status;
    servedAt;
    closedAt;
    handledBySessionId;
    handledByUserId;
    static _OPENAPI_METADATA_FACTORY() {
        return { registrationId: { required: true, type: () => Number }, status: { required: true, type: () => String }, servedAt: { required: false, type: () => String, nullable: true }, closedAt: { required: false, type: () => String, nullable: true }, handledBySessionId: { required: false, type: () => Number, nullable: true }, handledByUserId: { required: true, type: () => Number } };
    }
}
exports.CompleteRegistrationResponseDto = CompleteRegistrationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], CompleteRegistrationResponseDto.prototype, "registrationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'served', enum: ['served', 'no_show'] }),
    __metadata("design:type", String)
], CompleteRegistrationResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T09:15:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], CompleteRegistrationResponseDto.prototype, "servedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T09:15:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], CompleteRegistrationResponseDto.prototype, "closedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12, nullable: true }),
    __metadata("design:type", Object)
], CompleteRegistrationResponseDto.prototype, "handledBySessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], CompleteRegistrationResponseDto.prototype, "handledByUserId", void 0);
//# sourceMappingURL=queue-engine-response.dto.js.map