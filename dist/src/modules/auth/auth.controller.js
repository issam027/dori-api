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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const auth_response_dto_1 = require("./dto/auth-response.dto");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(dto, ipAddress, userAgent) {
        return this.authService.login(dto, ipAddress, userAgent);
    }
    async refresh(dto, ipAddress, userAgent) {
        return this.authService.refresh(dto, ipAddress, userAgent);
    }
    async logout(dto) {
        return this.authService.logout(dto);
    }
    async getMe(user) {
        return this.authService.getMe(user);
    }
    async changePassword(userId, dto) {
        return this.authService.changePassword(userId, dto);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({ summary: 'Connexion utilisateur et émission de tokens' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.LoginResponseDto,
        description: 'Authentification réussie, émission des jetons d’accès et de rafraîchissement',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, swagger_1.ApiOperation)({ summary: 'Échange du refresh token avec rotation' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.RefreshResponseDto,
        description: 'Nouveau token d’accès et refresh token renouvelé par rotation',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Ip)()),
    __param(2, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.RefreshTokenDto, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiOperation)({ summary: 'Déconnexion et révocation de la session' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Session révoquée avec succès',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: "Profil et périmètre de l'utilisateur connecté" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.UserMeResponseDto,
        description: 'Détails du compte, rôles, permissions et périmètre de sites/files autorisés',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.Post)('password/change'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Changement de mot de passe' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Mot de passe mis à jour avec succès',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, login_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentification'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map