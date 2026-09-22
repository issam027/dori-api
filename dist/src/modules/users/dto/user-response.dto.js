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
exports.RoleAssignmentResponseDto = exports.RoleResponseDto = exports.RolePermissionItemDto = exports.PermissionDto = exports.UserDetailResponseDto = exports.UserAssignedQueueDto = exports.UserAssignedSiteDto = exports.UserSummaryResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class UserSummaryResponseDto {
    userId;
    username;
    email;
    userType;
    isActive;
    languagePreference;
    lastLogin;
    createdAt;
    roles;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, userType: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, languagePreference: { required: true, type: () => String }, lastLogin: { required: false, type: () => Date, nullable: true }, createdAt: { required: true, type: () => Date }, roles: { required: true, type: () => [String] } };
    }
}
exports.UserSummaryResponseDto = UserSummaryResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UserSummaryResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'agent_med' }),
    __metadata("design:type", String)
], UserSummaryResponseDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'agent@dori.tn', nullable: true }),
    __metadata("design:type", Object)
], UserSummaryResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], UserSummaryResponseDto.prototype, "userType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserSummaryResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], UserSummaryResponseDto.prototype, "languagePreference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T08:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], UserSummaryResponseDto.prototype, "lastLogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], UserSummaryResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['operator'], isArray: true }),
    __metadata("design:type", Array)
], UserSummaryResponseDto.prototype, "roles", void 0);
class UserAssignedSiteDto {
    siteId;
    siteName;
    static _OPENAPI_METADATA_FACTORY() {
        return { siteId: { required: true, type: () => Number }, siteName: { required: true, type: () => String } };
    }
}
exports.UserAssignedSiteDto = UserAssignedSiteDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UserAssignedSiteDto.prototype, "siteId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Clinique Pasteur' }),
    __metadata("design:type", String)
], UserAssignedSiteDto.prototype, "siteName", void 0);
class UserAssignedQueueDto {
    queueId;
    queueCode;
    queueName;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, queueCode: { required: true, type: () => String }, queueName: { required: false, type: () => String, nullable: true } };
    }
}
exports.UserAssignedQueueDto = UserAssignedQueueDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UserAssignedQueueDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], UserAssignedQueueDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Médecine Générale', nullable: true }),
    __metadata("design:type", Object)
], UserAssignedQueueDto.prototype, "queueName", void 0);
class UserDetailResponseDto {
    userId;
    username;
    email;
    userType;
    isActive;
    languagePreference;
    lastLogin;
    createdAt;
    roles;
    sites;
    queues;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, userType: { required: true, type: () => String }, isActive: { required: true, type: () => Boolean }, languagePreference: { required: true, type: () => String }, lastLogin: { required: false, type: () => Date, nullable: true }, createdAt: { required: true, type: () => Date }, roles: { required: true, type: () => [String] }, sites: { required: true, type: () => [require("./user-response.dto").UserAssignedSiteDto] }, queues: { required: true, type: () => [require("./user-response.dto").UserAssignedQueueDto] } };
    }
}
exports.UserDetailResponseDto = UserDetailResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], UserDetailResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'agent_med' }),
    __metadata("design:type", String)
], UserDetailResponseDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'agent@dori.tn', nullable: true }),
    __metadata("design:type", Object)
], UserDetailResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], UserDetailResponseDto.prototype, "userType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserDetailResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'fr' }),
    __metadata("design:type", String)
], UserDetailResponseDto.prototype, "languagePreference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T08:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], UserDetailResponseDto.prototype, "lastLogin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], UserDetailResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['operator'], isArray: true }),
    __metadata("design:type", Array)
], UserDetailResponseDto.prototype, "roles", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UserAssignedSiteDto] }),
    __metadata("design:type", Array)
], UserDetailResponseDto.prototype, "sites", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UserAssignedQueueDto] }),
    __metadata("design:type", Array)
], UserDetailResponseDto.prototype, "queues", void 0);
class PermissionDto {
    permissionId;
    permissionName;
    description;
    static _OPENAPI_METADATA_FACTORY() {
        return { permissionId: { required: true, type: () => Number }, permissionName: { required: true, type: () => String }, description: { required: false, type: () => String, nullable: true } };
    }
}
exports.PermissionDto = PermissionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], PermissionDto.prototype, "permissionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'queue_view' }),
    __metadata("design:type", String)
], PermissionDto.prototype, "permissionName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Visualiser les files', nullable: true }),
    __metadata("design:type", Object)
], PermissionDto.prototype, "description", void 0);
class RolePermissionItemDto {
    permission;
    static _OPENAPI_METADATA_FACTORY() {
        return { permission: { required: true, type: () => require("./user-response.dto").PermissionDto } };
    }
}
exports.RolePermissionItemDto = RolePermissionItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PermissionDto }),
    __metadata("design:type", PermissionDto)
], RolePermissionItemDto.prototype, "permission", void 0);
class RoleResponseDto {
    roleId;
    roleName;
    rank;
    description;
    isActive;
    rolePermissions;
    static _OPENAPI_METADATA_FACTORY() {
        return { roleId: { required: true, type: () => Number }, roleName: { required: true, type: () => String }, rank: { required: true, type: () => Number }, description: { required: false, type: () => String, nullable: true }, isActive: { required: true, type: () => Boolean }, rolePermissions: { required: true, type: () => [require("./user-response.dto").RolePermissionItemDto] } };
    }
}
exports.RoleResponseDto = RoleResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], RoleResponseDto.prototype, "roleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'operator' }),
    __metadata("design:type", String)
], RoleResponseDto.prototype, "roleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20, description: 'Rang hiérarchique anti-escalade' }),
    __metadata("design:type", Number)
], RoleResponseDto.prototype, "rank", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Opérateur de guichet physique', nullable: true }),
    __metadata("design:type", Object)
], RoleResponseDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], RoleResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [RolePermissionItemDto] }),
    __metadata("design:type", Array)
], RoleResponseDto.prototype, "rolePermissions", void 0);
class RoleAssignmentResponseDto {
    success;
    roleId;
    roleName;
    static _OPENAPI_METADATA_FACTORY() {
        return { success: { required: true, type: () => Boolean }, roleId: { required: true, type: () => Number }, roleName: { required: true, type: () => String } };
    }
}
exports.RoleAssignmentResponseDto = RoleAssignmentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], RoleAssignmentResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], RoleAssignmentResponseDto.prototype, "roleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'operator' }),
    __metadata("design:type", String)
], RoleAssignmentResponseDto.prototype, "roleName", void 0);
//# sourceMappingURL=user-response.dto.js.map