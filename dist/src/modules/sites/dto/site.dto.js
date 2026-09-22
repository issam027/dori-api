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
exports.AssignManagerDto = exports.UpdateSiteDto = exports.CreateSiteDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateSiteDto {
    siteName;
    siteLocation;
    siteLogoUrl;
    siteType;
    timezone;
    defaultCurrency;
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
    static _OPENAPI_METADATA_FACTORY() {
        return { siteName: { required: true, type: () => String }, siteLocation: { required: false, type: () => String }, siteLogoUrl: { required: false, type: () => String }, siteType: { required: false, type: () => String, enum: ['public', 'private'] }, timezone: { required: false, type: () => String }, defaultCurrency: { required: false, type: () => String }, defaultAppointmentsEnabled: { required: false, type: () => Boolean }, defaultAppointmentSlotDuration: { required: false, type: () => Number, minimum: 1 }, defaultSlotCapacity: { required: false, type: () => Number, minimum: 1 }, defaultWorkingHoursStart: { required: false, type: () => String }, defaultWorkingHoursEnd: { required: false, type: () => String }, defaultBreakStart: { required: false, type: () => String }, defaultBreakEnd: { required: false, type: () => String }, defaultLateToleranceMinutes: { required: false, type: () => Number }, defaultCarryOverWaiting: { required: false, type: () => Boolean }, defaultDailyResetMode: { required: false, type: () => String, enum: ['close_all', 'close_served_only'] }, defaultDailyResetTime: { required: false, type: () => String }, defaultLocale: { required: false, type: () => String } };
    }
}
exports.CreateSiteDto = CreateSiteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Clinique Pasteur' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "siteName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Tunis, Berges du Lac' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "siteLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "siteLogoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['public', 'private'], default: 'public' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['public', 'private']),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "siteType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'Africa/Tunis' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'TND' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultCurrency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSiteDto.prototype, "defaultAppointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 15 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateSiteDto.prototype, "defaultAppointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateSiteDto.prototype, "defaultSlotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '08:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultWorkingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '17:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultWorkingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '12:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultBreakStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '14:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultBreakEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 60 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateSiteDto.prototype, "defaultLateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSiteDto.prototype, "defaultCarryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['close_all', 'close_served_only'], default: 'close_all' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['close_all', 'close_served_only']),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultDailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '03:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultDailyResetTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'fr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSiteDto.prototype, "defaultLocale", void 0);
class UpdateSiteDto {
    siteName;
    siteLocation;
    siteLogoUrl;
    siteType;
    timezone;
    defaultCurrency;
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
    static _OPENAPI_METADATA_FACTORY() {
        return { siteName: { required: false, type: () => String }, siteLocation: { required: false, type: () => String }, siteLogoUrl: { required: false, type: () => String }, siteType: { required: false, type: () => String, enum: ['public', 'private'] }, timezone: { required: false, type: () => String }, defaultCurrency: { required: false, type: () => String }, defaultAppointmentsEnabled: { required: false, type: () => Boolean }, defaultAppointmentSlotDuration: { required: false, type: () => Number }, defaultSlotCapacity: { required: false, type: () => Number }, defaultWorkingHoursStart: { required: false, type: () => String }, defaultWorkingHoursEnd: { required: false, type: () => String }, defaultBreakStart: { required: false, type: () => String }, defaultBreakEnd: { required: false, type: () => String }, defaultLateToleranceMinutes: { required: false, type: () => Number }, defaultCarryOverWaiting: { required: false, type: () => Boolean }, defaultDailyResetMode: { required: false, type: () => String, enum: ['close_all', 'close_served_only'] }, defaultDailyResetTime: { required: false, type: () => String }, defaultLocale: { required: false, type: () => String } };
    }
}
exports.UpdateSiteDto = UpdateSiteDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "siteName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "siteLocation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "siteLogoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['public', 'private'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['public', 'private']),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "siteType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "timezone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultCurrency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSiteDto.prototype, "defaultAppointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateSiteDto.prototype, "defaultAppointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateSiteDto.prototype, "defaultSlotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultWorkingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultWorkingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultBreakStart", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultBreakEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateSiteDto.prototype, "defaultLateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSiteDto.prototype, "defaultCarryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['close_all', 'close_served_only'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['close_all', 'close_served_only']),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultDailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultDailyResetTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSiteDto.prototype, "defaultLocale", void 0);
class AssignManagerDto {
    userId;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number } };
    }
}
exports.AssignManagerDto = AssignManagerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 7 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], AssignManagerDto.prototype, "userId", void 0);
//# sourceMappingURL=site.dto.js.map