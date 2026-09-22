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
exports.TranslationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const translations_service_1 = require("./translations.service");
const translation_dto_1 = require("./dto/translation.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const translation_response_dto_1 = require("./dto/translation-response.dto");
let TranslationsController = class TranslationsController {
    translationsService;
    constructor(translationsService) {
        this.translationsService = translationsService;
    }
    async getBundle(locale, category) {
        return this.translationsService.getBundle(locale || 'fr', category || 'ihm');
    }
    async findAll(pagination, category, locale, key) {
        return this.translationsService.findAll(pagination, category, locale, key);
    }
    async create(dto) {
        return this.translationsService.create(dto);
    }
    async update(translationId, dto) {
        return this.translationsService.update(translationId, dto);
    }
    async delete(translationId) {
        return this.translationsService.delete(translationId);
    }
};
exports.TranslationsController = TranslationsController;
__decorate([
    (0, common_1.Get)('bundle'),
    (0, swagger_1.ApiOperation)({ summary: 'Télécharger le bundle complet de traduction IHM avec version (§6.7)' }),
    (0, swagger_1.ApiQuery)({ name: 'locale', required: false, example: 'fr' }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false, example: 'ihm' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: translation_response_dto_1.TranslationBundleResponseDto,
        description: 'Dictionnaire clé/valeur pour l’IHM avec numéro de version du cache (§6.7)',
    }),
    __param(0, (0, common_1.Query)('locale')),
    __param(1, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TranslationsController.prototype, "getBundle", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('translation_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Liste paginée des clés de traduction' }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'locale', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'key', required: false }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: translation_response_dto_1.TranslationResponseDto,
        isPaginated: true,
        description: 'Liste paginée des libellés et textes du système',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('locale')),
    __param(3, (0, common_1.Query)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto, String, String, String]),
    __metadata("design:returntype", Promise)
], TranslationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('translation_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une traduction avec validation des paramètres attendus' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: translation_response_dto_1.TranslationResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Traduction créée avec incrémentation de la version du bundle',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [translation_dto_1.CreateTranslationDto]),
    __metadata("design:returntype", Promise)
], TranslationsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':translationId'),
    (0, permissions_decorator_1.RequirePermission)('translation_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Mettre à jour une traduction' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: translation_response_dto_1.TranslationResponseDto,
        description: 'Traduction modifiée avec incrémentation de version',
    }),
    __param(0, (0, common_1.Param)('translationId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, translation_dto_1.UpdateTranslationDto]),
    __metadata("design:returntype", Promise)
], TranslationsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':translationId'),
    (0, permissions_decorator_1.RequirePermission)('translation_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Désactiver une traduction (soft delete)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: translation_response_dto_1.TranslationResponseDto,
        description: 'Traduction désactivée',
    }),
    __param(0, (0, common_1.Param)('translationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TranslationsController.prototype, "delete", null);
exports.TranslationsController = TranslationsController = __decorate([
    (0, swagger_1.ApiTags)('Traductions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('translations'),
    __metadata("design:paramtypes", [translations_service_1.TranslationsService])
], TranslationsController);
//# sourceMappingURL=translations.controller.js.map