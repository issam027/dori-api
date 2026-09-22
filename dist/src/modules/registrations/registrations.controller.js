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
exports.RegistrationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const registrations_service_1 = require("./registrations.service");
const registration_dto_1 = require("./dto/registration.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const registration_response_dto_1 = require("./dto/registration-response.dto");
const auth_response_dto_1 = require("../auth/dto/auth-response.dto");
let RegistrationsController = class RegistrationsController {
    registrationsService;
    constructor(registrationsService) {
        this.registrationsService = registrationsService;
    }
    async getAvailability(user, queueId, dateStr) {
        if (!dateStr)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'date' });
        return this.registrationsService.getAvailability(user, queueId, dateStr);
    }
    async findAll(user, pagination, queueId, status, entryType) {
        return this.registrationsService.findAll(user, pagination, queueId ? Number(queueId) : undefined, status, entryType);
    }
    async create(user, dto) {
        return this.registrationsService.create(user, dto);
    }
    async findById(user, registrationId) {
        return this.registrationsService.findById(user, registrationId);
    }
    async reschedule(user, registrationId, dto) {
        return this.registrationsService.reschedule(user, registrationId, dto);
    }
    async checkIn(user, registrationId) {
        return this.registrationsService.checkIn(user, registrationId);
    }
    async delete(user, registrationId) {
        return this.registrationsService.delete(user, registrationId);
    }
    async getPublicPosition(token) {
        if (!token) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, {
                message: "L'en-tête X-Registration-Token est obligatoire",
            });
        }
        return this.registrationsService.getPublicPosition(token);
    }
};
exports.RegistrationsController = RegistrationsController;
__decorate([
    (0, common_1.Get)('queues/:queueId/availability'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('appointment_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Créneaux disponibles calculés à la volée (§4.2)' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: true, example: '2026-09-20' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.AvailabilityResponseDto,
        description: 'Créneaux horaires avec capacité et disponibilité calculée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Get)('registrations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('customer_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste paginée des inscriptions' }),
    (0, swagger_1.ApiQuery)({ name: 'queueId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'entryType', required: false }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.RegistrationDetailDto,
        isPaginated: true,
        description: 'Liste paginée des inscriptions avec client, queue et statut',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('queueId')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('entryType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto, Number, String, String]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('registrations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('customer_register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une inscription (walk-in ou RDV) (§6.5)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.RegistrationCreatedResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Inscription créée, ticket attribué et lien de suivi généré',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, registration_dto_1.CreateRegistrationDto]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('registrations/:registrationId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('customer_view'),
    (0, swagger_1.ApiOperation)({ summary: "Détails d'une inscription" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.RegistrationDetailDto,
        description: "Fiche complète de l'inscription et statut d'avancement",
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)('registrations/:registrationId/reschedule'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('appointment_manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reprogrammer un rendez-vous (§6.6)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.RescheduleResponseDto,
        description: 'Rendez-vous déplacé avec succès sur un nouveau créneau',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, registration_dto_1.RescheduleAppointmentDto]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "reschedule", null);
__decorate([
    (0, common_1.Post)('registrations/:registrationId/check-in'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('appointment_manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "Pointage d'arrivée (check-in) d'un RDV" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.CheckInResponseDto,
        description: 'Pointage enregistré et passage en file active validé',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Delete)('registrations/:registrationId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.RequirePermission)('customer_delete'),
    (0, swagger_1.ApiOperation)({ summary: 'Annuler une inscription (soft delete)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: auth_response_dto_1.ActionSuccessResponseDto,
        description: 'Inscription annulée avec succès',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('registrationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "delete", null);
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Get)('public/registrations/position'),
    (0, swagger_1.ApiOperation)({ summary: 'Suivi public de position (authentifié par X-Registration-Token)' }),
    (0, swagger_1.ApiHeader)({ name: 'X-Registration-Token', required: true, description: 'UUID du jeton de suivi' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: registration_response_dto_1.PublicPositionResponseDto,
        description: 'Position en temps réel dans la file et estimation d’attente',
    }),
    __param(0, (0, common_1.Headers)('x-registration-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RegistrationsController.prototype, "getPublicPosition", null);
exports.RegistrationsController = RegistrationsController = __decorate([
    (0, swagger_1.ApiTags)('Inscriptions & Rendez-vous'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [registrations_service_1.RegistrationsService])
], RegistrationsController);
//# sourceMappingURL=registrations.controller.js.map