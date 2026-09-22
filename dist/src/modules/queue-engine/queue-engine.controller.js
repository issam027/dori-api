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
exports.QueueEngineController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const queue_engine_service_1 = require("./queue-engine.service");
const session_dto_1 = require("./dto/session.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const queue_engine_response_dto_1 = require("./dto/queue-engine-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let QueueEngineController = class QueueEngineController {
    queueEngineService;
    constructor(queueEngineService) {
        this.queueEngineService = queueEngineService;
    }
    async openSession(user, queueId, dto) {
        return this.queueEngineService.openSession(user, queueId, dto);
    }
    async closeSession(user, queueId, sessionId) {
        return this.queueEngineService.closeSession(user, queueId, sessionId);
    }
    async callNext(user, queueId) {
        return this.queueEngineService.callNext(user, queueId);
    }
    async markServed(user, registrationId) {
        return this.queueEngineService.markServed(user, registrationId);
    }
    async markNoShow(user, registrationId) {
        return this.queueEngineService.markNoShow(user, registrationId);
    }
};
exports.QueueEngineController = QueueEngineController;
__decorate([
    (0, common_1.Post)('queues/:queueId/sessions'),
    (0, permissions_decorator_1.RequirePermission)('session_operate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Ouvrir ou reprendre un guichet (§6.2)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_engine_response_dto_1.OpenSessionResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Session de guichet ouverte ou reprise (reprise transparente (§6.2))',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, session_dto_1.OpenSessionDto]),
    __metadata("design:returntype", Promise)
], QueueEngineController.prototype, "openSession", null);
__decorate([
    (0, common_1.Delete)('queues/:queueId/sessions/:sessionId'),
    (0, permissions_decorator_1.RequirePermission)('session_operate'),
    (0, swagger_1.ApiOperation)({ summary: 'Fermer et libérer un guichet' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Guichet fermé et session terminée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('sessionId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], QueueEngineController.prototype, "closeSession", null);
__decorate([
    (0, common_1.Post)('queues/:queueId/next'),
    (0, permissions_decorator_1.RequirePermission)('customer_call'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Appeler le client suivant dans la file (§6.3)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_engine_response_dto_1.CallNextResponseDto,
        description: 'Client sélectionné selon le score de priorité dynamique (ou null si file vide)',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueueEngineController.prototype, "callNext", null);
__decorate([
    (0, common_1.Post)('registrations/:registrationId/served'),
    (0, permissions_decorator_1.RequirePermission)('customer_call'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Marquer un client comme servi (§6.4)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_engine_response_dto_1.CompleteRegistrationResponseDto,
        description: 'Client marqué comme servi',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueueEngineController.prototype, "markServed", null);
__decorate([
    (0, common_1.Post)('registrations/:registrationId/no-show'),
    (0, permissions_decorator_1.RequirePermission)('customer_call'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Marquer un client absent / non présenté (§6.4)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: queue_engine_response_dto_1.CompleteRegistrationResponseDto,
        description: 'Client marqué comme non présenté',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], QueueEngineController.prototype, "markNoShow", null);
exports.QueueEngineController = QueueEngineController = __decorate([
    (0, swagger_1.ApiTags)('Guichets & Traitement'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [queue_engine_service_1.QueueEngineService])
], QueueEngineController);
//# sourceMappingURL=queue-engine.controller.js.map