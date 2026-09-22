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
exports.QueuesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const queues_service_1 = require("./queues.service");
const queue_dto_1 = require("./dto/queue.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const queue_response_dto_1 = require("./dto/queue-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let QueuesController = class QueuesController {
    queuesService;
    constructor(queuesService) {
        this.queuesService = queuesService;
    }
    async create(siteId, dto) {
        return this.queuesService.create(siteId, dto);
    }
    async findBySite(user, siteId) {
        return this.queuesService.findBySite(user, siteId);
    }
    async findById(user, queueId) {
        return this.queuesService.findById(user, queueId);
    }
    async update(user, queueId, dto) {
        return this.queuesService.update(user, queueId, dto);
    }
    async delete(user, queueId) {
        return this.queuesService.delete(user, queueId);
    }
    async getStatus(user, queueId) {
        return this.queuesService.getStatus(user, queueId);
    }
    async getThreads(user, queueId) {
        return this.queuesService.getThreads(user, queueId);
    }
    async getOperators(user, queueId) {
        return this.queuesService.getOperators(user, queueId);
    }
    async assignOperator(user, queueId, dto) {
        return this.queuesService.assignOperator(user, queueId, dto.userId);
    }
    async unassignOperator(user, queueId, userId) {
        return this.queuesService.unassignOperator(user, queueId, userId);
    }
};
exports.QueuesController = QueuesController;
__decorate([
    (0, common_1.Post)('sites/:siteId/queues'),
    (0, permissions_decorator_1.RequirePermission)('queue_create'),
    (0, swagger_1.ApiOperation)({ summary: "Créer une file d'attente dans un site" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: "File créée avec association automatique au forfait 'free'",
    }),
    __param(0, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, queue_dto_1.CreateQueueDto]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('sites/:siteId/queues'),
    (0, permissions_decorator_1.RequirePermission)('queue_view'),
    (0, swagger_1.ApiOperation)({ summary: "Liste des files d'un site selon le périmètre" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueResponseDto,
        isArray: true,
        description: 'Liste des files du site avec configuration effective résolue',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('siteId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "findBySite", null);
__decorate([
    (0, common_1.Get)('queues/:queueId'),
    (0, permissions_decorator_1.RequirePermission)('queue_view'),
    (0, swagger_1.ApiOperation)({ summary: "Détails et configuration effective d'une file (avec origine de l'héritage §4.5)" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueResponseDto,
        description: "Configuration complète de la file avec indication de source ('inherited' | 'overridden')",
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "findById", null);
__decorate([
    (0, common_1.Patch)('queues/:queueId'),
    (0, permissions_decorator_1.RequirePermission)('queue_edit'),
    (0, swagger_1.ApiOperation)({ summary: "Mettre à jour une file d'attente" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueResponseDto,
        description: 'File mise à jour avec recalcul de la configuration effective',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, queue_dto_1.UpdateQueueDto]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('queues/:queueId'),
    (0, permissions_decorator_1.RequirePermission)('queue_delete'),
    (0, swagger_1.ApiOperation)({ summary: "Désactiver une file d'attente (soft delete)" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueResponseDto,
        description: 'File désactivée (soft delete)',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/status'),
    (0, permissions_decorator_1.RequirePermission)('queue_view'),
    (0, swagger_1.ApiOperation)({ summary: "Statut temps réel de la file (attente, guichets, prochains RDV)" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueStatusResponseDto,
        description: "Statut temps réel de la file d'attente pour le jour ouvrable courant",
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/threads'),
    (0, permissions_decorator_1.RequirePermission)('queue_view'),
    (0, swagger_1.ApiOperation)({ summary: 'État des guichets (threads) conformément au contrat §6.1' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueThreadsResponseDto,
        description: 'État dynamique des guichets physiques et des sessions d’opérateurs',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "getThreads", null);
__decorate([
    (0, common_1.Get)('queues/:queueId/operators'),
    (0, permissions_decorator_1.RequirePermission)('user_queue_assign'),
    (0, swagger_1.ApiOperation)({ summary: "Liste des opérateurs et bornes affectés à la file" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueOperatorDto,
        isArray: true,
        description: 'Liste des utilisateurs habilités à opérer sur la file',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "getOperators", null);
__decorate([
    (0, common_1.Post)('queues/:queueId/operators'),
    (0, permissions_decorator_1.RequirePermission)('user_queue_assign'),
    (0, swagger_1.ApiOperation)({ summary: "Affecter un opérateur ou une borne à la file" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_response_dto_1.QueueOperatorAssignmentResponseDto,
        description: 'Opérateur affecté à la file',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, queue_dto_1.AssignOperatorDto]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "assignOperator", null);
__decorate([
    (0, common_1.Delete)('queues/:queueId/operators/:userId'),
    (0, permissions_decorator_1.RequirePermission)('user_queue_assign'),
    (0, swagger_1.ApiOperation)({ summary: "Retirer l'affectation d'un opérateur sur la file" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Affectation supprimée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], QueuesController.prototype, "unassignOperator", null);
exports.QueuesController = QueuesController = __decorate([
    (0, swagger_1.ApiTags)('Queues'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [queues_service_1.QueuesService])
], QueuesController);
//# sourceMappingURL=queues.controller.js.map