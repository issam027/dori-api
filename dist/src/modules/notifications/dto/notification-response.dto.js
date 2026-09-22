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
exports.NotificationResponseDto = exports.NotificationCustomerSummaryDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class NotificationCustomerSummaryDto {
    ticketNumber;
    queueId;
    static _OPENAPI_METADATA_FACTORY() {
        return { ticketNumber: { required: true, type: () => String }, queueId: { required: true, type: () => Number } };
    }
}
exports.NotificationCustomerSummaryDto = NotificationCustomerSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED001' }),
    __metadata("design:type", String)
], NotificationCustomerSummaryDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], NotificationCustomerSummaryDto.prototype, "queueId", void 0);
class NotificationResponseDto {
    notificationId;
    customerId;
    channel;
    recipient;
    payload;
    notificationStatus;
    attemptCount;
    failureReason;
    providerMessageId;
    customer;
    sentAt;
    deliveredAt;
    createdAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { notificationId: { required: true, type: () => Number }, customerId: { required: true, type: () => Number }, channel: { required: true, type: () => String }, recipient: { required: true, type: () => String }, payload: { required: true, type: () => String }, notificationStatus: { required: true, type: () => String }, attemptCount: { required: true, type: () => Number }, failureReason: { required: false, type: () => String, nullable: true }, providerMessageId: { required: false, type: () => String, nullable: true }, customer: { required: false, type: () => require("./notification-response.dto").NotificationCustomerSummaryDto }, sentAt: { required: false, type: () => Date, nullable: true }, deliveredAt: { required: false, type: () => Date, nullable: true }, createdAt: { required: true, type: () => Date } };
    }
}
exports.NotificationResponseDto = NotificationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], NotificationResponseDto.prototype, "notificationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], NotificationResponseDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sms', enum: ['sms', 'email', 'voice'] }),
    __metadata("design:type", String)
], NotificationResponseDto.prototype, "channel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+21698123456' }),
    __metadata("design:type", String)
], NotificationResponseDto.prototype, "recipient", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Votre ticket MED001 est prêt à être appelé au guichet 2.' }),
    __metadata("design:type", String)
], NotificationResponseDto.prototype, "payload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sent', enum: ['pending', 'sent', 'delivered', 'failed'] }),
    __metadata("design:type", String)
], NotificationResponseDto.prototype, "notificationStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], NotificationResponseDto.prototype, "attemptCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, nullable: true }),
    __metadata("design:type", Object)
], NotificationResponseDto.prototype, "failureReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'MSG-987654321', nullable: true }),
    __metadata("design:type", Object)
], NotificationResponseDto.prototype, "providerMessageId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: NotificationCustomerSummaryDto }),
    __metadata("design:type", NotificationCustomerSummaryDto)
], NotificationResponseDto.prototype, "customer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T08:30:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], NotificationResponseDto.prototype, "sentAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T08:30:05.000Z', nullable: true }),
    __metadata("design:type", Object)
], NotificationResponseDto.prototype, "deliveredAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:29:55.000Z' }),
    __metadata("design:type", Date)
], NotificationResponseDto.prototype, "createdAt", void 0);
//# sourceMappingURL=notification-response.dto.js.map