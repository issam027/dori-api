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
exports.ServiceTiersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const service_tiers_service_1 = require("./service-tiers.service");
const tier_dto_1 = require("./dto/tier.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const tier_response_dto_1 = require("./dto/tier-response.dto");
let ServiceTiersController = class ServiceTiersController {
    serviceTiersService;
    constructor(serviceTiersService) {
        this.serviceTiersService = serviceTiersService;
    }
    async findAllTiers(pagination) {
        return this.serviceTiersService.findAllTiers(pagination);
    }
    async createTier(dto) {
        return this.serviceTiersService.createTier(dto);
    }
    async findTierById(tierId) {
        return this.serviceTiersService.findTierById(tierId);
    }
    async updateTier(tierId, dto) {
        return this.serviceTiersService.updateTier(tierId, dto);
    }
    async deleteTier(tierId) {
        return this.serviceTiersService.deleteTier(tierId);
    }
    async findTiersByQueue(user, queueId) {
        return this.serviceTiersService.findTiersByQueue(user, queueId);
    }
    async associateTierToQueue(user, queueId, dto) {
        return this.serviceTiersService.associateTierToQueue(user, queueId, dto);
    }
    async updateQueueTier(user, queueId, tierId, dto) {
        return this.serviceTiersService.updateQueueTier(user, queueId, tierId, dto);
    }
    async deleteQueueTier(user, queueId, tierId) {
        return this.serviceTiersService.deleteQueueTier(user, queueId, tierId);
    }
    async findRulesByQueueTier(user, queueId, tierId) {
        return this.serviceTiersService.findRulesByQueueTier(user, queueId, tierId);
    }
    async createNotificationRule(user, queueId, tierId, dto) {
        return this.serviceTiersService.createNotificationRule(user, queueId, tierId, dto);
    }
    async updateNotificationRule(user, queueId, tierId, ruleId, dto) {
        return this.serviceTiersService.updateNotificationRule(user, queueId, tierId, ruleId, dto);
    }
    async deleteNotificationRule(user, queueId, tierId, ruleId) {
        return this.serviceTiersService.deleteNotificationRule(user, queueId, tierId, ruleId);
    }
    async getDisplay(user, queueId) {
        return this.serviceTiersService.getDisplayScreen(user, queueId);
    }
};
exports.ServiceTiersController = ServiceTiersController;
__decorate([
    (0, common_1.Get)('tiers'),
    (0, permissions_decorator_1.RequirePermission)('tier_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Catalogue global des forfaits (paginé)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.GlobalTierResponseDto,
        isPaginated: true,
        description: 'Liste paginée des forfaits du catalogue global',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "findAllTiers", null);
__decorate([
    (0, common_1.Post)('tiers'),
    (0, permissions_decorator_1.RequirePermission)('tier_catalog_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer un forfait dans le catalogue global' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.GlobalTierResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Forfait créé dans le catalogue global',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tier_dto_1.CreateTierDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "createTier", null);
__decorate([
    (0, common_1.Get)('tiers/:tierId'),
    (0, permissions_decorator_1.RequirePermission)('tier_view'),
    (0, swagger_1.ApiOperation)({ summary: "Détails d'un forfait global" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.GlobalTierResponseDto,
        description: "Informations d'un forfait global",
    }),
    __param(0, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "findTierById", null);
__decorate([
    (0, common_1.Patch)('tiers/:tierId'),
    (0, permissions_decorator_1.RequirePermission)('tier_catalog_manage'),
    (0, swagger_1.ApiOperation)({ summary: "Modifier un forfait global" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.GlobalTierResponseDto,
        description: 'Forfait global mis à jour',
    }),
    __param(0, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tier_dto_1.UpdateTierDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "updateTier", null);
__decorate([
    (0, common_1.Delete)('tiers/:tierId'),
    (0, permissions_decorator_1.RequirePermission)('tier_catalog_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer un forfait global (refusé si is_system)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.GlobalTierResponseDto,
        description: 'Forfait global désactivé',
    }),
    __param(0, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "deleteTier", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/tiers'),
    (0, permissions_decorator_1.RequirePermission)('tier_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Forfaits proposés par une file (prix, devise, règles)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.QueueTierResponseDto,
        isArray: true,
        description: 'Forfaits et règles de notification appliqués à cette file',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "findTiersByQueue", null);
__decorate([
    (0, common_1.Post)('queues/:queueId/tiers'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Associer un forfait à une file (prix et devise)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.QueueTierResponseDto,
        description: 'Forfait associé à la file avec tarif personnalisé',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, tier_dto_1.AssociateQueueTierDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "associateTierToQueue", null);
__decorate([
    (0, common_1.Patch)('queues/:queueId/tiers/:tierId'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifier le tarif ou la devise du forfait sur la file' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.QueueTierResponseDto,
        description: 'Tarif du forfait sur la file modifié',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, tier_dto_1.UpdateQueueTierDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "updateQueueTier", null);
__decorate([
    (0, common_1.Delete)('queues/:queueId/tiers/:tierId'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Retirer un forfait de la file (interdit pour free)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.QueueTierResponseDto,
        description: 'Forfait retiré de la file',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "deleteQueueTier", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/tiers/:tierId/notification-rules'),
    (0, permissions_decorator_1.RequirePermission)('tier_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Règles de notification pour un forfait sur une file' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.NotificationRuleResponseDto,
        isArray: true,
        description: 'Règles de déclenchement des notifications SMS/Email/Voice',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "findRulesByQueueTier", null);
__decorate([
    (0, common_1.Post)('queues/:queueId/tiers/:tierId/notification-rules'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une règle de notification (welcome ou threshold)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.NotificationRuleResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Règle de notification configurée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, tier_dto_1.CreateNotificationRuleDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "createNotificationRule", null);
__decorate([
    (0, common_1.Patch)('queues/:queueId/tiers/:tierId/notification-rules/:ruleId'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifier une règle de notification' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.NotificationRuleResponseDto,
        description: 'Règle de notification mise à jour',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Param)('ruleId', common_1.ParseIntPipe)),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, Number, tier_dto_1.UpdateNotificationRuleDto]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "updateNotificationRule", null);
__decorate([
    (0, common_1.Delete)('queues/:queueId/tiers/:tierId/notification-rules/:ruleId'),
    (0, permissions_decorator_1.RequirePermission)('queue_tier_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Désactiver une règle de notification' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.NotificationRuleResponseDto,
        description: 'Règle de notification désactivée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('tierId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Param)('ruleId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "deleteNotificationRule", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/display'),
    (0, swagger_1.ApiOperation)({ summary: "Écran d'affichage salle d'attente (anonymisé)" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: tier_response_dto_1.QueueDisplayScreenResponseDto,
        description: "Données temps réel de la salle d'attente (tickets appelés par guichet et prochains tickets)",
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ServiceTiersController.prototype, "getDisplay", null);
exports.ServiceTiersController = ServiceTiersController = __decorate([
    (0, swagger_1.ApiTags)('Forfaits de service & Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [service_tiers_service_1.ServiceTiersService])
], ServiceTiersController);
//# sourceMappingURL=service-tiers.controller.js.map