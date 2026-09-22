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
exports.SitesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const sites_service_1 = require("./sites.service");
const site_dto_1 = require("./dto/site.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const site_response_dto_1 = require("./dto/site-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let SitesController = class SitesController {
    sitesService;
    constructor(sitesService) {
        this.sitesService = sitesService;
    }
    async findAll(user, pagination) {
        return this.sitesService.findAll(user, pagination);
    }
    async create(dto) {
        return this.sitesService.create(dto);
    }
    async findById(user, siteId) {
        return this.sitesService.findById(user, siteId);
    }
    async update(user, siteId, dto) {
        return this.sitesService.update(user, siteId, dto);
    }
    async delete(user, siteId) {
        return this.sitesService.delete(user, siteId);
    }
    async getManagers(user, siteId) {
        return this.sitesService.getManagers(user, siteId);
    }
    async assignManager(user, siteId, dto) {
        return this.sitesService.assignManager(user, siteId, dto.userId);
    }
    async unassignManager(user, siteId, userId) {
        return this.sitesService.unassignManager(user, siteId, userId);
    }
};
exports.SitesController = SitesController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('site_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste paginée des sites accessibles selon le périmètre' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteResponseDto,
        isPaginated: true,
        description: 'Liste paginée des sites accessibles',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('site_create'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer un site' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Site créé avec succès',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [site_dto_1.CreateSiteDto]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':siteId'),
    (0, permissions_decorator_1.RequirePermission)('site_view'),
    (0, swagger_1.ApiOperation)({ summary: "Détails d'un site" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteResponseDto,
        description: "Informations et configuration par défaut du site",
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "findById", null);
__decorate([
    (0, common_1.Patch)(':siteId'),
    (0, permissions_decorator_1.RequirePermission)('site_edit'),
    (0, swagger_1.ApiOperation)({ summary: "Mettre à jour un site" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteResponseDto,
        description: 'Site mis à jour',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, site_dto_1.UpdateSiteDto]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':siteId'),
    (0, permissions_decorator_1.RequirePermission)('site_delete'),
    (0, swagger_1.ApiOperation)({ summary: 'Désactiver un site (soft delete)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteResponseDto,
        description: 'Site désactivé (soft delete avec propagation aux files)',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(':siteId/managers'),
    (0, permissions_decorator_1.RequirePermission)('user_site_assign'),
    (0, swagger_1.ApiOperation)({ summary: "Liste des managers affectés au site" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteManagerDto,
        isArray: true,
        description: 'Liste des utilisateurs ayant le rôle gestionnaire sur ce site',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "getManagers", null);
__decorate([
    (0, common_1.Post)(':siteId/managers'),
    (0, permissions_decorator_1.RequirePermission)('user_site_assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Affecter un manager au site' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: site_response_dto_1.SiteManagerAssignmentResponseDto,
        description: 'Manager assigné au site',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, site_dto_1.AssignManagerDto]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "assignManager", null);
__decorate([
    (0, common_1.Delete)(':siteId/managers/:userId'),
    (0, permissions_decorator_1.RequirePermission)('user_site_assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Retirer un manager du site' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Affectation du manager supprimée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], SitesController.prototype, "unassignManager", null);
exports.SitesController = SitesController = __decorate([
    (0, swagger_1.ApiTags)('Sites'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('sites'),
    __metadata("design:paramtypes", [sites_service_1.SitesService])
], SitesController);
//# sourceMappingURL=sites.controller.js.map