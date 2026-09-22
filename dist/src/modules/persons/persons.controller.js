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
exports.PersonsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const persons_service_1 = require("./persons.service");
const person_dto_1 = require("./dto/person.dto");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const person_response_dto_1 = require("./dto/person-response.dto");
let PersonsController = class PersonsController {
    personsService;
    constructor(personsService) {
        this.personsService = personsService;
    }
    async findAll(user, pagination, search) {
        return this.personsService.findAll(user, pagination, search);
    }
    async create(dto) {
        return this.personsService.create(dto);
    }
    async findById(user, personId) {
        return this.personsService.findById(user, personId);
    }
    async update(user, personId, dto) {
        return this.personsService.update(user, personId, dto);
    }
    async findNotes(user, personId) {
        return this.personsService.findNotes(user, personId);
    }
    async createNote(user, personId, dto) {
        return this.personsService.createNote(user, personId, dto);
    }
    async updateNote(user, personId, noteId, dto) {
        return this.personsService.updateNote(user, personId, noteId, dto);
    }
    async deleteNote(user, personId, noteId) {
        return this.personsService.deleteNote(user, personId, noteId);
    }
};
exports.PersonsController = PersonsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('customer_view'),
    (0, swagger_1.ApiOperation)({ summary: 'Recherche paginée de personnes dans le périmètre accessible' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: 'Recherche par nom, prénom, email, téléphone' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonResponseDto,
        isPaginated: true,
        description: 'Liste paginée des personnes enregistrées',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto, String]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('customer_register'),
    (0, swagger_1.ApiOperation)({ summary: 'Créer une identité personne' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Fiche personne créée avec succès',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [person_dto_1.CreatePersonDto]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':personId'),
    (0, permissions_decorator_1.RequirePermission)('customer_view'),
    (0, swagger_1.ApiOperation)({ summary: "Consulter la fiche d'une personne" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonResponseDto,
        description: 'Détails de la fiche personne',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "findById", null);
__decorate([
    (0, common_1.Patch)(':personId'),
    (0, permissions_decorator_1.RequirePermission)('customer_edit'),
    (0, swagger_1.ApiOperation)({ summary: "Mettre à jour les informations d'une personne" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonResponseDto,
        description: 'Fiche personne mise à jour',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, person_dto_1.UpdatePersonDto]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':personId/notes'),
    (0, permissions_decorator_1.RequirePermission)('person_note_view'),
    (0, swagger_1.ApiOperation)({ summary: "Consulter les notes d'une personne (réservé hôtesse et +)" }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonNoteResponseDto,
        isArray: true,
        description: 'Historique des notes internes attachées à la personne',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "findNotes", null);
__decorate([
    (0, common_1.Post)(':personId/notes'),
    (0, permissions_decorator_1.RequirePermission)('person_note_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Ajouter une note sur une personne' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonNoteResponseDto,
        status: common_1.HttpStatus.CREATED,
        description: 'Note interne enregistrée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, person_dto_1.CreatePersonNoteDto]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "createNote", null);
__decorate([
    (0, common_1.Patch)(':personId/notes/:noteId'),
    (0, permissions_decorator_1.RequirePermission)('person_note_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Modifier une note existante' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonNoteResponseDto,
        description: 'Note interne modifiée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('noteId', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, person_dto_1.UpdatePersonNoteDto]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "updateNote", null);
__decorate([
    (0, common_1.Delete)(':personId/notes/:noteId'),
    (0, permissions_decorator_1.RequirePermission)('person_note_manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Supprimer une note (soft delete)' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: person_response_dto_1.PersonNoteResponseDto,
        description: 'Note interne désactivée',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('personId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Param)('noteId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], PersonsController.prototype, "deleteNote", null);
exports.PersonsController = PersonsController = __decorate([
    (0, swagger_1.ApiTags)('Personnes & Notes'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('persons'),
    __metadata("design:paramtypes", [persons_service_1.PersonsService])
], PersonsController);
//# sourceMappingURL=persons.controller.js.map