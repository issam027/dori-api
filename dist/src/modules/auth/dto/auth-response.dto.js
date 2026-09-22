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
exports.ActionSuccessResponseDto = exports.UserMeResponseDto = exports.UserScopeDto = exports.RefreshResponseDto = exports.LoginResponseDto = exports.AuthUserSummaryDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class AuthUserSummaryDto {
    userId;
    username;
    email;
    roles;
    permissions;
    userType;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, roles: { required: true, type: () => [String] }, permissions: { required: true, type: () => [String] }, userType: { required: true, type: () => String } };
    }
}
exports.AuthUserSummaryDto = AuthUserSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], AuthUserSummaryDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin' }),
    __metadata("design:type", String)
], AuthUserSummaryDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'admin@dori.tn', nullable: true }),
    __metadata("design:type", Object)
], AuthUserSummaryDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['admin_site'], isArray: true }),
    __metadata("design:type", Array)
], AuthUserSummaryDto.prototype, "roles", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['site_view', 'queue_view'], isArray: true }),
    __metadata("design:type", Array)
], AuthUserSummaryDto.prototype, "permissions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], AuthUserSummaryDto.prototype, "userType", void 0);
class LoginResponseDto {
    accessToken;
    refreshToken;
    expiresIn;
    mustChangePassword;
    user;
    static _OPENAPI_METADATA_FACTORY() {
        return { accessToken: { required: true, type: () => String }, refreshToken: { required: true, type: () => String }, expiresIn: { required: true, type: () => Number }, mustChangePassword: { required: true, type: () => Boolean }, user: { required: true, type: () => require("./auth-response.dto").AuthUserSummaryDto } };
    }
}
exports.LoginResponseDto = LoginResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "accessToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'a9f0e1b2c3d4e5f6...' }),
    __metadata("design:type", String)
], LoginResponseDto.prototype, "refreshToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3600 }),
    __metadata("design:type", Number)
], LoginResponseDto.prototype, "expiresIn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], LoginResponseDto.prototype, "mustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthUserSummaryDto }),
    __metadata("design:type", AuthUserSummaryDto)
], LoginResponseDto.prototype, "user", void 0);
class RefreshResponseDto {
    accessToken;
    refreshToken;
    expiresIn;
    static _OPENAPI_METADATA_FACTORY() {
        return { accessToken: { required: true, type: () => String }, refreshToken: { required: true, type: () => String }, expiresIn: { required: true, type: () => Number } };
    }
}
exports.RefreshResponseDto = RefreshResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    __metadata("design:type", String)
], RefreshResponseDto.prototype, "accessToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'c1d2e3f4a5b6c7d8...' }),
    __metadata("design:type", String)
], RefreshResponseDto.prototype, "refreshToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3600 }),
    __metadata("design:type", Number)
], RefreshResponseDto.prototype, "expiresIn", void 0);
class UserScopeDto {
    allSites;
    allowedSiteIds;
    allowedQueueIds;
    static _OPENAPI_METADATA_FACTORY() {
        return { allSites: { required: true, type: () => Boolean }, allowedSiteIds: { required: true, type: () => [Number] }, allowedQueueIds: { required: true, type: () => [Number] } };
    }
}
exports.UserScopeDto = UserScopeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Accès sans restriction à tous les sites (root)' }),
    __metadata("design:type", Boolean)
], UserScopeDto.prototype, "allSites", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [1, 2], isArray: true, description: 'IDs des sites autorisés' }),
    __metadata("design:type", Array)
], UserScopeDto.prototype, "allowedSiteIds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [1, 2, 3], isArray: true, description: 'IDs des files autorisées' }),
    __metadata("design:type", Array)
], UserScopeDto.prototype, "allowedQueueIds", void 0);
class UserMeResponseDto {
    userId;
    username;
    email;
    userType;
    languagePreference;
    mustChangePassword;
    createdAt;
    roles;
    permissions;
    scope;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, userType: { required: true, type: () => String }, languagePreference: { required: true, type: () => String }, mustChangePassword: { required: true, type: () => Boolean }, createdAt: { required: true, type: () => Date }, roles: { required: true, type: () => [String] }, permissions: { required: true, type: () => [String] }, scope: { required: true, type: () => require("./auth-response.dto").UserScopeDto } };
    }
}
exports.UserMeResponseDto = UserMeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UserMeResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin' }),
    __metadata("design:type", String)
], UserMeResponseDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'admin@dori.tn', nullable: true }),
    __metadata("design:type", Object)
], UserMeResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], UserMeResponseDto.prototype, "userType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], UserMeResponseDto.prototype, "languagePreference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], UserMeResponseDto.prototype, "mustChangePassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], UserMeResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['admin_site'], isArray: true }),
    __metadata("design:type", Array)
], UserMeResponseDto.prototype, "roles", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['site_view', 'queue_view'], isArray: true }),
    __metadata("design:type", Array)
], UserMeResponseDto.prototype, "permissions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserScopeDto }),
    __metadata("design:type", UserScopeDto)
], UserMeResponseDto.prototype, "scope", void 0);
class ActionSuccessResponseDto {
    success;
    static _OPENAPI_METADATA_FACTORY() {
        return { success: { required: true, type: () => Boolean } };
    }
}
exports.ActionSuccessResponseDto = ActionSuccessResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ActionSuccessResponseDto.prototype, "success", void 0);
//# sourceMappingURL=auth-response.dto.js.map