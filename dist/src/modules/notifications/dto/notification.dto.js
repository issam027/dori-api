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
exports.WebhookNotificationDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class WebhookNotificationDto {
    providerMessageId;
    status;
    failureReason;
    static _OPENAPI_METADATA_FACTORY() {
        return { providerMessageId: { required: true, type: () => String }, status: { required: true, type: () => String }, failureReason: { required: false, type: () => String } };
    }
}
exports.WebhookNotificationDto = WebhookNotificationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'msg_123456789' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WebhookNotificationDto.prototype, "providerMessageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['delivered', 'failed'] }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], WebhookNotificationDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebhookNotificationDto.prototype, "failureReason", void 0);
//# sourceMappingURL=notification.dto.js.map