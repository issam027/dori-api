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
exports.AssignRoleDto = exports.ResetUserPasswordDto = exports.UpdateUserStatusDto = exports.UpdateUserDto = exports.CreateUserDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateUserDto {
    username;
    email;
    password;
    userType;
    roleName;
    languagePreference;
    static _OPENAPI_METADATA_FACTORY() {
        return { username: { required: true, type: () => String }, email: { required: false, type: () => String, format: "email" }, password: { required: true, type: () => String, minLength: 10 }, userType: { required: false, type: () => String, enum: ['human', 'kiosk'] }, roleName: { required: true, type: () => String }, languagePreference: { required: false, type: () => String } };
    }
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'amel.b' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'amel.b@dori.tn' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 10, example: 'InitialSecret2026!' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['human', 'kiosk'], default: 'human' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['human', 'kiosk']),
    __metadata("design:type", String)
], CreateUserDto.prototype, "userType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'hotesse', description: 'Rôle initial attribué' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "roleName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'fr' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "languagePreference", void 0);
class UpdateUserDto {
    email;
    languagePreference;
    static _OPENAPI_METADATA_FACTORY() {
        return { email: { required: false, type: () => String, format: "email" }, languagePreference: { required: false, type: () => String } };
    }
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "languagePreference", void 0);
class UpdateUserStatusDto {
    isActive;
    static _OPENAPI_METADATA_FACTORY() {
        return { isActive: { required: true, type: () => Boolean } };
    }
}
exports.UpdateUserStatusDto = UpdateUserStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserStatusDto.prototype, "isActive", void 0);
class ResetUserPasswordDto {
    newPassword;
    static _OPENAPI_METADATA_FACTORY() {
        return { newPassword: { required: true, type: () => String, minLength: 10 } };
    }
}
exports.ResetUserPasswordDto = ResetUserPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 10, example: 'NewPassSecure2026!' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], ResetUserPasswordDto.prototype, "newPassword", void 0);
class AssignRoleDto {
    roleId;
    static _OPENAPI_METADATA_FACTORY() {
        return { roleId: { required: true, type: () => Number } };
    }
}
exports.AssignRoleDto = AssignRoleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], AssignRoleDto.prototype, "roleId", void 0);
//# sourceMappingURL=user.dto.js.map