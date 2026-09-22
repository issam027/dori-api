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
exports.PublicPositionResponseDto = exports.CheckInResponseDto = exports.RescheduleResponseDto = exports.RegistrationDetailDto = exports.QueueTierFullSummaryDto = exports.QueueHeaderSummaryDto = exports.RegistrationCreatedResponseDto = exports.RegistrationTierSummaryDto = exports.AvailabilityResponseDto = exports.AvailabilitySlotDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const person_response_dto_1 = require("../../persons/dto/person-response.dto");
class AvailabilitySlotDto {
    time;
    slotCapacity;
    bookedCount;
    availableCount;
    isFull;
    static _OPENAPI_METADATA_FACTORY() {
        return { time: { required: true, type: () => String }, slotCapacity: { required: true, type: () => Number }, bookedCount: { required: true, type: () => Number }, availableCount: { required: true, type: () => Number }, isFull: { required: true, type: () => Boolean } };
    }
}
exports.AvailabilitySlotDto = AvailabilitySlotDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '08:00', description: 'Heure de début du créneau (HH:mm)' }),
    __metadata("design:type", String)
], AvailabilitySlotDto.prototype, "time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Capacité maximale d’inscriptions par créneau' }),
    __metadata("design:type", Number)
], AvailabilitySlotDto.prototype, "slotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Nombre d’inscriptions déjà validées' }),
    __metadata("design:type", Number)
], AvailabilitySlotDto.prototype, "bookedCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Places restantes disponibles' }),
    __metadata("design:type", Number)
], AvailabilitySlotDto.prototype, "availableCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Indique si le créneau est complet' }),
    __metadata("design:type", Boolean)
], AvailabilitySlotDto.prototype, "isFull", void 0);
class AvailabilityResponseDto {
    queueId;
    date;
    slotDuration;
    slots;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, date: { required: true, type: () => String }, slotDuration: { required: true, type: () => Number }, slots: { required: true, type: () => [require("./registration-response.dto").AvailabilitySlotDto] } };
    }
}
exports.AvailabilityResponseDto = AvailabilityResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], AvailabilityResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], AvailabilityResponseDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15, description: 'Durée d’un créneau en minutes' }),
    __metadata("design:type", Number)
], AvailabilityResponseDto.prototype, "slotDuration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [AvailabilitySlotDto] }),
    __metadata("design:type", Array)
], AvailabilityResponseDto.prototype, "slots", void 0);
class RegistrationTierSummaryDto {
    tierId;
    tierCode;
    price;
    currency;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, tierCode: { required: true, type: () => String }, price: { required: false, type: () => Number }, currency: { required: false, type: () => String } };
    }
}
exports.RegistrationTierSummaryDto = RegistrationTierSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], RegistrationTierSummaryDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'free' }),
    __metadata("design:type", String)
], RegistrationTierSummaryDto.prototype, "tierCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, nullable: true }),
    __metadata("design:type", Number)
], RegistrationTierSummaryDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TND', nullable: true }),
    __metadata("design:type", String)
], RegistrationTierSummaryDto.prototype, "currency", void 0);
class RegistrationCreatedResponseDto {
    registrationId;
    ticketNumber;
    businessDate;
    entryType;
    appointmentStatus;
    scheduledTime;
    status;
    tier;
    priorityReferenceTime;
    trackingUrl;
    registrationTrackingTokenValidUntil;
    static _OPENAPI_METADATA_FACTORY() {
        return { registrationId: { required: true, type: () => Number }, ticketNumber: { required: true, type: () => String }, businessDate: { required: true, type: () => String }, entryType: { required: true, type: () => String }, appointmentStatus: { required: false, type: () => String, nullable: true }, scheduledTime: { required: false, type: () => String, nullable: true }, status: { required: true, type: () => String }, tier: { required: true, type: () => require("./registration-response.dto").RegistrationTierSummaryDto }, priorityReferenceTime: { required: true, type: () => String }, trackingUrl: { required: false, type: () => String }, registrationTrackingTokenValidUntil: { required: true, type: () => String } };
    }
}
exports.RegistrationCreatedResponseDto = RegistrationCreatedResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], RegistrationCreatedResponseDto.prototype, "registrationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED001' }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "businessDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'walkin', enum: ['walkin', 'appointment'] }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "entryType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'booked', enum: ['booked', 'checked_in', 'expired', null], nullable: true }),
    __metadata("design:type", Object)
], RegistrationCreatedResponseDto.prototype, "appointmentStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T09:30:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], RegistrationCreatedResponseDto.prototype, "scheduledTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired'] }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: RegistrationTierSummaryDto }),
    __metadata("design:type", RegistrationTierSummaryDto)
], RegistrationCreatedResponseDto.prototype, "tier", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "priorityReferenceTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'https://suivi.dori.tn/#token123', nullable: true }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "trackingUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T23:59:59.000Z' }),
    __metadata("design:type", String)
], RegistrationCreatedResponseDto.prototype, "registrationTrackingTokenValidUntil", void 0);
class QueueHeaderSummaryDto {
    queueCode;
    queueName;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueCode: { required: true, type: () => String }, queueName: { required: false, type: () => String, nullable: true } };
    }
}
exports.QueueHeaderSummaryDto = QueueHeaderSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], QueueHeaderSummaryDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Médecine Générale', nullable: true }),
    __metadata("design:type", Object)
], QueueHeaderSummaryDto.prototype, "queueName", void 0);
class QueueTierFullSummaryDto {
    tierId;
    queueId;
    price;
    currency;
    tier;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, queueId: { required: true, type: () => Number }, price: { required: true, type: () => Number }, currency: { required: true, type: () => String }, tier: { required: true, type: () => require("./registration-response.dto").RegistrationTierSummaryDto } };
    }
}
exports.QueueTierFullSummaryDto = QueueTierFullSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueTierFullSummaryDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueTierFullSummaryDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], QueueTierFullSummaryDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TND' }),
    __metadata("design:type", String)
], QueueTierFullSummaryDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: RegistrationTierSummaryDto }),
    __metadata("design:type", RegistrationTierSummaryDto)
], QueueTierFullSummaryDto.prototype, "tier", void 0);
class RegistrationDetailDto {
    customerId;
    personId;
    queueId;
    tierId;
    businessDate;
    ticketNumber;
    entryType;
    scheduledTime;
    appointmentStatus;
    priorityReferenceTime;
    status;
    calledAt;
    servedAt;
    closedAt;
    person;
    queue;
    queueTier;
    static _OPENAPI_METADATA_FACTORY() {
        return { customerId: { required: true, type: () => Number }, personId: { required: true, type: () => Number }, queueId: { required: true, type: () => Number }, tierId: { required: true, type: () => Number }, businessDate: { required: true, type: () => Date }, ticketNumber: { required: true, type: () => String }, entryType: { required: true, type: () => String }, scheduledTime: { required: false, type: () => Date, nullable: true }, appointmentStatus: { required: false, type: () => String, nullable: true }, priorityReferenceTime: { required: true, type: () => Date }, status: { required: true, type: () => String }, calledAt: { required: false, type: () => Date, nullable: true }, servedAt: { required: false, type: () => Date, nullable: true }, closedAt: { required: false, type: () => Date, nullable: true }, person: { required: true, type: () => require("../../persons/dto/person-response.dto").PersonResponseDto }, queue: { required: true, type: () => require("./registration-response.dto").QueueHeaderSummaryDto }, queueTier: { required: false, type: () => require("./registration-response.dto").QueueTierFullSummaryDto, nullable: true } };
    }
}
exports.RegistrationDetailDto = RegistrationDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], RegistrationDetailDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], RegistrationDetailDto.prototype, "personId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], RegistrationDetailDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], RegistrationDetailDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T00:00:00.000Z' }),
    __metadata("design:type", Date)
], RegistrationDetailDto.prototype, "businessDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED001' }),
    __metadata("design:type", String)
], RegistrationDetailDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'walkin', enum: ['walkin', 'appointment'] }),
    __metadata("design:type", String)
], RegistrationDetailDto.prototype, "entryType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "scheduledTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "appointmentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], RegistrationDetailDto.prototype, "priorityReferenceTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired'] }),
    __metadata("design:type", String)
], RegistrationDetailDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "calledAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "servedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "closedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: person_response_dto_1.PersonResponseDto }),
    __metadata("design:type", person_response_dto_1.PersonResponseDto)
], RegistrationDetailDto.prototype, "person", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QueueHeaderSummaryDto }),
    __metadata("design:type", QueueHeaderSummaryDto)
], RegistrationDetailDto.prototype, "queue", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: QueueTierFullSummaryDto, nullable: true }),
    __metadata("design:type", Object)
], RegistrationDetailDto.prototype, "queueTier", void 0);
class RescheduleResponseDto {
    registrationId;
    appointmentStatus;
    scheduledTime;
    priorityReferenceTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { registrationId: { required: true, type: () => Number }, appointmentStatus: { required: true, type: () => String }, scheduledTime: { required: true, type: () => String }, priorityReferenceTime: { required: true, type: () => String } };
    }
}
exports.RescheduleResponseDto = RescheduleResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], RescheduleResponseDto.prototype, "registrationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'booked' }),
    __metadata("design:type", String)
], RescheduleResponseDto.prototype, "appointmentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T11:00:00.000Z' }),
    __metadata("design:type", String)
], RescheduleResponseDto.prototype, "scheduledTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T11:00:00.000Z' }),
    __metadata("design:type", String)
], RescheduleResponseDto.prototype, "priorityReferenceTime", void 0);
class CheckInResponseDto {
    registrationId;
    appointmentStatus;
    checkedInAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { registrationId: { required: true, type: () => Number }, appointmentStatus: { required: true, type: () => String }, checkedInAt: { required: true, type: () => String } };
    }
}
exports.CheckInResponseDto = CheckInResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], CheckInResponseDto.prototype, "registrationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'checked_in' }),
    __metadata("design:type", String)
], CheckInResponseDto.prototype, "appointmentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T09:15:00.000Z' }),
    __metadata("design:type", String)
], CheckInResponseDto.prototype, "checkedInAt", void 0);
class PublicPositionResponseDto {
    ticketNumber;
    status;
    position;
    estimatedWaitMinutes;
    static _OPENAPI_METADATA_FACTORY() {
        return { ticketNumber: { required: true, type: () => String }, status: { required: true, type: () => String }, position: { required: false, type: () => Number }, estimatedWaitMinutes: { required: false, type: () => Number } };
    }
}
exports.PublicPositionResponseDto = PublicPositionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED001' }),
    __metadata("design:type", String)
], PublicPositionResponseDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'waiting', enum: ['waiting', 'in_progress', 'served', 'no_show', 'expired', 'closed'] }),
    __metadata("design:type", String)
], PublicPositionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 3, description: 'Position courante dans la file d’attente' }),
    __metadata("design:type", Number)
], PublicPositionResponseDto.prototype, "position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20, description: 'Temps d’attente estimé en minutes' }),
    __metadata("design:type", Number)
], PublicPositionResponseDto.prototype, "estimatedWaitMinutes", void 0);
//# sourceMappingURL=registration-response.dto.js.map