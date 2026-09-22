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
exports.SiteManagerAssignmentResponseDto = exports.SiteManagerDto = exports.SiteResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class SiteResponseDto {
    siteId;
    siteName;
    siteLocation;
    siteLogoUrl;
    siteType;
    timezone;
    defaultCurrency;
    isActive;
    defaultAppointmentsEnabled;
    defaultAppointmentSlotDuration;
    defaultSlotCapacity;
    defaultWorkingHoursStart;
    defaultWorkingHoursEnd;
    defaultBreakStart;
    defaultBreakEnd;
    defaultLateToleranceMinutes;
    defaultCarryOverWaiting;
    defaultDailyResetMode;
    defaultDailyResetTime;
    defaultLocale;
    createdAt;
    updatedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { siteId: { required: true, type: () => Number }, siteName: { required: true, type: () => String }, siteLocation: { required: false, type: () => String, nullable: true }, siteLogoUrl: { required: false, type: () => String, nullable: true }, siteType: { required: true, type: () => String }, timezone: { required: true, type: () => String }, defaultCurrency: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, defaultAppointmentsEnabled: { required: true, type: () => Boolean }, defaultAppointmentSlotDuration: { required: true, type: () => Number }, defaultSlotCapacity: { required: true, type: () => Number }, defaultWorkingHoursStart: { required: true, type: () => String }, defaultWorkingHoursEnd: { required: true, type: () => String }, defaultBreakStart: { required: false, type: () => String, nullable: true }, defaultBreakEnd: { required: false, type: () => String, nullable: true }, defaultLateToleranceMinutes: { required: true, type: () => Number }, defaultCarryOverWaiting: { required: true, type: () => Boolean }, defaultDailyResetMode: { required: true, type: () => String }, defaultDailyResetTime: { required: true, type: () => String }, defaultLocale: { required: true, type: () => String }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date } };
    }
}
exports.SiteResponseDto = SiteResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SiteResponseDto.prototype, "siteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Clinique Pasteur' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "siteName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Tunis, Berges du Lac', nullable: true }),
    __metadata("design:type", Object)
], SiteResponseDto.prototype, "siteLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'https://cdn.dori.tn/logos/pasteur.png', nullable: true }),
    __metadata("design:type", Object)
], SiteResponseDto.prototype, "siteLogoUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'public', enum: ['public', 'private'] }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "siteType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Africa/Tunis' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'TND' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultCurrency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], SiteResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SiteResponseDto.prototype, "defaultAppointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15 }),
    __metadata("design:type", Number)
], SiteResponseDto.prototype, "defaultAppointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SiteResponseDto.prototype, "defaultSlotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '08:00' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultWorkingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '17:00' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultWorkingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '12:00', nullable: true }),
    __metadata("design:type", Object)
], SiteResponseDto.prototype, "defaultBreakStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '14:00', nullable: true }),
    __metadata("design:type", Object)
], SiteResponseDto.prototype, "defaultBreakEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60 }),
    __metadata("design:type", Number)
], SiteResponseDto.prototype, "defaultLateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], SiteResponseDto.prototype, "defaultCarryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'close_all', enum: ['close_all', 'close_served_only'] }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultDailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '03:00' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultDailyResetTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], SiteResponseDto.prototype, "defaultLocale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], SiteResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], SiteResponseDto.prototype, "updatedAt", void 0);
class SiteManagerDto {
    userId;
    username;
    email;
    userType;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, userType: { required: true, type: () => String } };
    }
}
exports.SiteManagerDto = SiteManagerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 7 }),
    __metadata("design:type", Number)
], SiteManagerDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'manager_pasteur' }),
    __metadata("design:type", String)
], SiteManagerDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'manager@pasteur.tn', nullable: true }),
    __metadata("design:type", Object)
], SiteManagerDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], SiteManagerDto.prototype, "userType", void 0);
class SiteManagerAssignmentResponseDto {
    userId;
    siteId;
    assignedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, siteId: { required: true, type: () => Number }, assignedAt: { required: true, type: () => Date } };
    }
}
exports.SiteManagerAssignmentResponseDto = SiteManagerAssignmentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 7 }),
    __metadata("design:type", Number)
], SiteManagerAssignmentResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], SiteManagerAssignmentResponseDto.prototype, "siteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], SiteManagerAssignmentResponseDto.prototype, "assignedAt", void 0);
//# sourceMappingURL=site-response.dto.js.map