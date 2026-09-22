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
exports.NotificationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const notifications_service_1 = require("./notifications.service");
const notification_dto_1 = require("./dto/notification.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const notification_response_dto_1 = require("./dto/notification-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let NotificationsController = class NotificationsController {
    notificationsService;
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async findAll(user, pagination, registrationId, channel, status) {
        return this.notificationsService.findAll(user, pagination, registrationId ? Number(registrationId) : undefined, channel, status);
    }
    async findById(user, notificationId) {
        return this.notificationsService.findById(user, notificationId);
    }
    async resend(user, notificationId) {
        return this.notificationsService.resend(user, notificationId);
    }
    async handleWebhook(provider, dto) {
        return this.notificationsService.handleWebhook(provider, dto);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('notification_view'),
    (0, swagger_1.ApiOperation)({ summary: "Historique paginé des notifications" }),
    (0, swagger_1.ApiQuery)({ name: 'registrationId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'channel', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: notification_response_dto_1.NotificationResponseDto,
        isPaginated: true,
        description: 'Historique des notifications filtrées par canal ou statut',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('registrationId')),
    __param(3, (0, common_1.Query)('channel')),
    __param(4, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto, Number, String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('notifications/:notificationId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('notification_view'),
    (0, swagger_1.ApiOperation)({ summary: "Détails d'une notification" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: notification_response_dto_1.NotificationResponseDto,
        description: 'Détails du message, statut de livraison et destinataire',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('notificationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)('notifications/:notificationId/resend'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('notification_send'),
    (0, swagger_1.ApiOperation)({ summary: 'Renvoyer manuellement une notification en échec' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: notification_response_dto_1.NotificationResponseDto,
        description: 'Notification remise en file d’attente d’envoi',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('notificationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "resend", null);
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Post)('webhooks/notifications/:provider'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Webhook fournisseur de mise à jour du statut de notification' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Statut du message mis à jour via webhook',
    }),
    __param(0, (0, common_1.Param)('provider')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, notification_dto_1.WebhookNotificationDto]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "handleWebhook", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map