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
exports.UsersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const user_dto_1 = require("./dto/user.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const user_response_dto_1 = require("./dto/user-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async findAll(user, pagination, userType) {
        return this.usersService.findAll(user, pagination, userType);
    }
    async create(user, dto) {
        return this.usersService.create(user, dto);
    }
    async findById(user, userId) {
        return this.usersService.findById(user, userId);
    }
    async update(user, userId, dto) {
        return this.usersService.update(user, userId, dto);
    }
    async updateStatus(user, userId, dto) {
        return this.usersService.updateStatus(user, userId, dto);
    }
    async resetPassword(user, userId, dto) {
        return this.usersService.resetPassword(user, userId, dto);
    }
    async assignRole(user, userId, dto) {
        return this.usersService.assignRole(user, userId, dto.roleId);
    }
    async unassignRole(user, userId, roleId) {
        return this.usersService.unassignRole(user, userId, roleId);
    }
    async findAllRoles() {
        return this.usersService.findAllRoles();
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('users'),
    (0, permissions_decorator_1.RequirePermission)('user_manage_kiosk', 'user_manage_hostess'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste paginée des utilisateurs' }),
    (0, swagger_1.ApiQuery)({ name: 'userType', required: false, enum: ['human', 'kiosk'] }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.UserSummaryResponseDto,
        isPaginated: true,
        description: 'Liste paginée des utilisateurs avec leurs rôles',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('userType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer un utilisateur (contrainte anti-escalade)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.UserDetailResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Compte utilisateur créé avec succès',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('users/:userId'),
    (0, swagger_1.ApiOperation)({ summary: "Détails d'un utilisateur et ses affectations" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.UserDetailResponseDto,
        description: `Fiche complète de l'utilisateur avec ses sites et files assignées`,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findById", null);
__decorate([
    (0, common_1.Patch)('users/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'Mettre à jour le profil utilisateur' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.UserDetailResponseDto,
        description: 'Profil utilisateur mis à jour',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('users/:userId/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Activer / désactiver un compte (révoque les sessions)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Statut du compte modifié, sessions révoquées si désactivation',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, user_dto_1.UpdateUserStatusDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)('users/:userId/password'),
    (0, swagger_1.ApiOperation)({ summary: 'Attribuer un mot de passe (force le changement à la connexion)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: `Mot de passe réinitialisé, l'utilisateur devra le changer à sa prochaine connexion`,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, user_dto_1.ResetUserPasswordDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('users/:userId/roles'),
    (0, swagger_1.ApiOperation)({ summary: 'Attribuer un rôle à un utilisateur' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.RoleAssignmentResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: `Rôle attribué à l'utilisateur (contrainte anti-escalade respectée)`,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, user_dto_1.AssignRoleDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "assignRole", null);
__decorate([
    (0, common_1.Delete)('users/:userId/roles/:roleId'),
    (0, swagger_1.ApiOperation)({ summary: 'Retirer un rôle à un utilisateur' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: `Rôle retiré de l'utilisateur avec succès`,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('roleId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "unassignRole", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste des rôles et de leurs permissions' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: user_response_dto_1.RoleResponseDto,
        isArray: true,
        description: 'Catalogue complet des rôles avec leurs permissions associées',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAllRoles", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Utilisateurs & Rôles'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map