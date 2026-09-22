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
exports.UpdateNotificationRuleDto = exports.CreateNotificationRuleDto = exports.UpdateQueueTierDto = exports.AssociateQueueTierDto = exports.UpdateTierDto = exports.CreateTierDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateTierDto {
    tierCode;
    tierName;
    description;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierCode: { required: true, type: () => String }, tierName: { required: true, type: () => String }, description: { required: false, type: () => String } };
    }
}
exports.CreateTierDto = CreateTierDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'vip' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTierDto.prototype, "tierCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'VIP' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateTierDto.prototype, "tierName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTierDto.prototype, "description", void 0);
class UpdateTierDto {
    tierName;
    description;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierName: { required: false, type: () => String }, description: { required: false, type: () => String } };
    }
}
exports.UpdateTierDto = UpdateTierDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateTierDto.prototype, "tierName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateTierDto.prototype, "description", void 0);
class AssociateQueueTierDto {
    tierId;
    price = 0;
    currency;
    displayOrder;
    static _OPENAPI_METADATA_FACTORY() {
        return { tierId: { required: true, type: () => Number }, price: { required: true, type: () => Number, default: 0, minimum: 0 }, currency: { required: false, type: () => String }, displayOrder: { required: false, type: () => Number } };
    }
}
exports.AssociateQueueTierDto = AssociateQueueTierDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], AssociateQueueTierDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1.5, default: 0 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AssociateQueueTierDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'TND' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AssociateQueueTierDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AssociateQueueTierDto.prototype, "displayOrder", void 0);
class UpdateQueueTierDto {
    price;
    currency;
    displayOrder;
    static _OPENAPI_METADATA_FACTORY() {
        return { price: { required: false, type: () => Number, minimum: 0 }, currency: { required: false, type: () => String }, displayOrder: { required: false, type: () => Number } };
    }
}
exports.UpdateQueueTierDto = UpdateQueueTierDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateQueueTierDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateQueueTierDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateQueueTierDto.prototype, "displayOrder", void 0);
class CreateNotificationRuleDto {
    notificationType;
    channel;
    thresholdPosition;
    thresholdMinutes;
    includeTrackingLink;
    static _OPENAPI_METADATA_FACTORY() {
        return { notificationType: { required: true, type: () => String, enum: ['welcome', 'threshold'] }, channel: { required: true, type: () => String, enum: ['sms', 'voice_call', 'email'] }, thresholdPosition: { required: false, type: () => Number }, thresholdMinutes: { required: false, type: () => Number }, includeTrackingLink: { required: false, type: () => Boolean } };
    }
}
exports.CreateNotificationRuleDto = CreateNotificationRuleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['welcome', 'threshold'] }),
    (0, class_validator_1.IsIn)(['welcome', 'threshold']),
    __metadata("design:type", String)
], CreateNotificationRuleDto.prototype, "notificationType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['sms', 'voice_call', 'email'] }),
    (0, class_validator_1.IsIn)(['sms', 'voice_call', 'email']),
    __metadata("design:type", String)
], CreateNotificationRuleDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Déclenche quand position <= N' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNotificationRuleDto.prototype, "thresholdPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Déclenche quand attente estimée <= N minutes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNotificationRuleDto.prototype, "thresholdMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateNotificationRuleDto.prototype, "includeTrackingLink", void 0);
class UpdateNotificationRuleDto {
    thresholdPosition;
    thresholdMinutes;
    includeTrackingLink;
    static _OPENAPI_METADATA_FACTORY() {
        return { thresholdPosition: { required: false, type: () => Number }, thresholdMinutes: { required: false, type: () => Number }, includeTrackingLink: { required: false, type: () => Boolean } };
    }
}
exports.UpdateNotificationRuleDto = UpdateNotificationRuleDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateNotificationRuleDto.prototype, "thresholdPosition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateNotificationRuleDto.prototype, "thresholdMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateNotificationRuleDto.prototype, "includeTrackingLink", void 0);
//# sourceMappingURL=tier.dto.js.map