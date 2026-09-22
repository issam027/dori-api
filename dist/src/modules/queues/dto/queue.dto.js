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
exports.AssignOperatorDto = exports.UpdateQueueDto = exports.CreateQueueDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateQueueDto {
    queueCode;
    queueName;
    averageWaitTime;
    threadCount;
    appointmentsEnabled;
    appointmentSlotDuration;
    slotCapacity;
    workingHoursStart;
    workingHoursEnd;
    breakStart;
    breakEnd;
    lateToleranceMinutes;
    baseWeightWalkin;
    baseWeightAppointment;
    escalationRateWalkin;
    escalationRateAppointment;
    carryOverWaiting;
    dailyResetMode;
    dailyResetTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueCode: { required: true, type: () => String }, queueName: { required: false, type: () => String }, averageWaitTime: { required: false, type: () => Number, minimum: 1 }, threadCount: { required: false, type: () => Number, minimum: 1 }, appointmentsEnabled: { required: false, type: () => Boolean }, appointmentSlotDuration: { required: false, type: () => Number, minimum: 1 }, slotCapacity: { required: false, type: () => Number, minimum: 1 }, workingHoursStart: { required: false, type: () => String }, workingHoursEnd: { required: false, type: () => String }, breakStart: { required: false, type: () => String }, breakEnd: { required: false, type: () => String }, lateToleranceMinutes: { required: false, type: () => Number }, baseWeightWalkin: { required: false, type: () => Number }, baseWeightAppointment: { required: false, type: () => Number }, escalationRateWalkin: { required: false, type: () => Number }, escalationRateAppointment: { required: false, type: () => Number }, carryOverWaiting: { required: false, type: () => Boolean }, dailyResetMode: { required: false, type: () => String, enum: ['close_all', 'close_served_only'] }, dailyResetTime: { required: false, type: () => String } };
    }
}
exports.CreateQueueDto = CreateQueueDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PED', description: 'Code préfixe unique de la file sur le site' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Pédiatrie' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "queueName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 10, description: 'Temps moyen de traitement en minutes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "averageWaitTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, description: 'Nombre de guichets simultanés' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "threadCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQueueDto.prototype, "appointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "appointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "slotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "workingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "workingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "breakStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "breakEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "lateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "baseWeightWalkin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "baseWeightAppointment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "escalationRateWalkin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateQueueDto.prototype, "escalationRateAppointment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQueueDto.prototype, "carryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['close_all', 'close_served_only'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['close_all', 'close_served_only']),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "dailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "dailyResetTime", void 0);
class UpdateQueueDto {
    queueName;
    averageWaitTime;
    threadCount;
    appointmentsEnabled;
    appointmentSlotDuration;
    slotCapacity;
    workingHoursStart;
    workingHoursEnd;
    breakStart;
    breakEnd;
    lateToleranceMinutes;
    baseWeightWalkin;
    baseWeightAppointment;
    escalationRateWalkin;
    escalationRateAppointment;
    carryOverWaiting;
    dailyResetMode;
    dailyResetTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueName: { required: false, type: () => String }, averageWaitTime: { required: false, type: () => Number, minimum: 1 }, threadCount: { required: false, type: () => Number, minimum: 1 }, appointmentsEnabled: { required: false, type: () => Boolean }, appointmentSlotDuration: { required: false, type: () => Number }, slotCapacity: { required: false, type: () => Number }, workingHoursStart: { required: false, type: () => String }, workingHoursEnd: { required: false, type: () => String }, breakStart: { required: false, type: () => String }, breakEnd: { required: false, type: () => String }, lateToleranceMinutes: { required: false, type: () => Number }, baseWeightWalkin: { required: false, type: () => Number }, baseWeightAppointment: { required: false, type: () => Number }, escalationRateWalkin: { required: false, type: () => Number }, escalationRateAppointment: { required: false, type: () => Number }, carryOverWaiting: { required: false, type: () => Boolean }, dailyResetMode: { required: false, type: () => String, enum: ['close_all', 'close_served_only'] }, dailyResetTime: { required: false, type: () => String } };
    }
}
exports.UpdateQueueDto = UpdateQueueDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "queueName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "averageWaitTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "threadCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateQueueDto.prototype, "appointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "appointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "slotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "workingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "workingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "breakStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "breakEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "lateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "baseWeightWalkin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "baseWeightAppointment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "escalationRateWalkin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateQueueDto.prototype, "escalationRateAppointment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateQueueDto.prototype, "carryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['close_all', 'close_served_only'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['close_all', 'close_served_only']),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "dailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueDto.prototype, "dailyResetTime", void 0);
class AssignOperatorDto {
    userId;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number } };
    }
}
exports.AssignOperatorDto = AssignOperatorDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], AssignOperatorDto.prototype, "userId", void 0);
//# sourceMappingURL=queue.dto.js.map