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
exports.QueueDisplayScreenResponseDto = exports.DisplayCurrentCallDto = exports.QueueTierResponseDto = exports.NotificationRuleResponseDto = exports.GlobalTierResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class GlobalTierResponseDto {
    tierId;
    tierCode;
    tierName;
    description;
    isSystem;
    isActive;
    createdAt;
    updatedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, tierCode: { required: true, type: () => String }, tierName: { required: true, type: () => String }, description: { required: false, type: () => String, nullable: true }, isSystem: { required: true, type: () => Boolean }, isActive: { required: true, type: () => Boolean }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date } };
    }
}
exports.GlobalTierResponseDto = GlobalTierResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], GlobalTierResponseDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'free' }),
    __metadata("design:type", String)
], GlobalTierResponseDto.prototype, "tierCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Gratuit / Standard' }),
    __metadata("design:type", String)
], GlobalTierResponseDto.prototype, "tierName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Accès sans frais avec notification SMS basique', nullable: true }),
    __metadata("design:type", Object)
], GlobalTierResponseDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Indique si le forfait est natif système (non supprimable)' }),
    __metadata("design:type", Boolean)
], GlobalTierResponseDto.prototype, "isSystem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], GlobalTierResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], GlobalTierResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], GlobalTierResponseDto.prototype, "updatedAt", void 0);
class NotificationRuleResponseDto {
    ruleId;
    queueId;
    tierId;
    notificationType;
    channel;
    thresholdPosition;
    thresholdMinutes;
    includeTrackingLink;
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { ruleId: { required: true, type: () => Number }, queueId: { required: true, type: () => Number }, tierId: { required: true, type: () => Number }, notificationType: { required: true, type: () => String }, channel: { required: true, type: () => String }, thresholdPosition: { required: false, type: () => Number, nullable: true }, thresholdMinutes: { required: false, type: () => Number, nullable: true }, includeTrackingLink: { required: true, type: () => Boolean }, isActive: { required: true, type: () => Boolean } };
    }
}
exports.NotificationRuleResponseDto = NotificationRuleResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], NotificationRuleResponseDto.prototype, "ruleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], NotificationRuleResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], NotificationRuleResponseDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'threshold', enum: ['confirmation', 'threshold', 'called'] }),
    __metadata("design:type", String)
], NotificationRuleResponseDto.prototype, "notificationType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sms', enum: ['sms', 'email', 'voice'] }),
    __metadata("design:type", String)
], NotificationRuleResponseDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 3, nullable: true, description: 'Seuil en position dans la file' }),
    __metadata("design:type", Object)
], NotificationRuleResponseDto.prototype, "thresholdPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 15, nullable: true, description: 'Seuil en minutes avant RDV' }),
    __metadata("design:type", Object)
], NotificationRuleResponseDto.prototype, "thresholdMinutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], NotificationRuleResponseDto.prototype, "includeTrackingLink", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], NotificationRuleResponseDto.prototype, "isActive", void 0);
class QueueTierResponseDto {
    tierId;
    tierCode;
    tierName;
    isSystem;
    price;
    currency;
    displayOrder;
    notificationRules;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, tierCode: { required: true, type: () => String }, tierName: { required: true, type: () => String }, isSystem: { required: true, type: () => Boolean }, price: { required: true, type: () => Number }, currency: { required: true, type: () => String }, displayOrder: { required: true, type: () => Number }, notificationRules: { required: true, type: () => [require("./tier-response.dto").NotificationRuleResponseDto] } };
    }
}
exports.QueueTierResponseDto = QueueTierResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], QueueTierResponseDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'premium' }),
    __metadata("design:type", String)
], QueueTierResponseDto.prototype, "tierCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Forfait VIP' }),
    __metadata("design:type", String)
], QueueTierResponseDto.prototype, "tierName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], QueueTierResponseDto.prototype, "isSystem", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10.5, description: 'Tarif en devise locale' }),
    __metadata("design:type", Number)
], QueueTierResponseDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TND' }),
    __metadata("design:type", String)
], QueueTierResponseDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueTierResponseDto.prototype, "displayOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [NotificationRuleResponseDto] }),
    __metadata("design:type", Array)
], QueueTierResponseDto.prototype, "notificationRules", void 0);
class DisplayCurrentCallDto {
    threadNumber;
    ticketNumber;
    static _OPENAPI_METADATA_FACTORY() {
        return { threadNumber: { required: true, type: () => Number, nullable: true }, ticketNumber: { required: true, type: () => String } };
    }
}
exports.DisplayCurrentCallDto = DisplayCurrentCallDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, nullable: true }),
    __metadata("design:type", Object)
], DisplayCurrentCallDto.prototype, "threadNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A-015' }),
    __metadata("design:type", String)
], DisplayCurrentCallDto.prototype, "ticketNumber", void 0);
class QueueDisplayScreenResponseDto {
    queueId;
    queueCode;
    queueName;
    currentCalls;
    nextTickets;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, queueCode: { required: true, type: () => String }, queueName: { required: false, type: () => String, nullable: true }, currentCalls: { required: true, type: () => [require("./tier-response.dto").DisplayCurrentCallDto] }, nextTickets: { required: true, type: () => [String] } };
    }
}
exports.QueueDisplayScreenResponseDto = QueueDisplayScreenResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueDisplayScreenResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], QueueDisplayScreenResponseDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Médecine Générale', nullable: true }),
    __metadata("design:type", Object)
], QueueDisplayScreenResponseDto.prototype, "queueName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [DisplayCurrentCallDto], description: 'Appels en cours par guichet' }),
    __metadata("design:type", Array)
], QueueDisplayScreenResponseDto.prototype, "currentCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['A-016', 'A-017', 'A-018'], isArray: true, description: 'Prochains tickets en attente' }),
    __metadata("design:type", Array)
], QueueDisplayScreenResponseDto.prototype, "nextTickets", void 0);
//# sourceMappingURL=tier-response.dto.js.map