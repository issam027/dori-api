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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let PersonsService = class PersonsService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async validatePersonInScope(user, personId) {
        if (this.scopeService.isSystemUser(user))
            return;
        const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
        if (!allowedQueueIds || allowedQueueIds.length === 0) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.PERSON_NOT_FOUND, { personId });
        }
        const reg = await this.prisma.customer.findFirst({
            where: {
                personId,
                queueId: { in: allowedQueueIds },
            },
        });
        if (!reg) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.PERSON_NOT_FOUND, { personId });
        }
    }
    async findAll(user, pagination, search) {
        const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
        const whereClause = { isActive: true };
        if (allowedQueueIds !== null) {
            whereClause.customers = {
                some: {
                    queueId: { in: allowedQueueIds },
                },
            };
        }
        if (search) {
            whereClause.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.person.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            }),
            this.prisma.person.count({ where: whereClause }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findById(user, personId) {
        await this.validatePersonInScope(user, personId);
        const person = await this.prisma.person.findFirst({
            where: { personId, isActive: true },
        });
        if (!person)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.PERSON_NOT_FOUND, { personId });
        return person;
    }
    async create(dto) {
        return this.prisma.person.create({
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                email: dto.email,
                phoneNumber: dto.phoneNumber,
                birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
                languagePreference: dto.languagePreference || 'fr',
            },
        });
    }
    async update(user, personId, dto) {
        await this.validatePersonInScope(user, personId);
        return this.prisma.person.update({
            where: { personId },
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                email: dto.email,
                phoneNumber: dto.phoneNumber,
                birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
                languagePreference: dto.languagePreference,
            },
        });
    }
    async findNotes(user, personId) {
        await this.validatePersonInScope(user, personId);
        return this.prisma.personNote.findMany({
            where: { personId, isActive: true },
            include: {
                createdByUser: { select: { userId: true, username: true } },
                updatedByUser: { select: { userId: true, username: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createNote(user, personId, dto) {
        await this.validatePersonInScope(user, personId);
        return this.prisma.personNote.create({
            data: {
                personId,
                content: dto.content,
                createdByUserId: user.userId,
            },
            include: {
                createdByUser: { select: { userId: true, username: true } },
            },
        });
    }
    async updateNote(user, personId, noteId, dto) {
        await this.validatePersonInScope(user, personId);
        return this.prisma.personNote.update({
            where: { noteId },
            data: {
                content: dto.content,
                updatedByUserId: user.userId,
            },
            include: {
                updatedByUser: { select: { userId: true, username: true } },
            },
        });
    }
    async deleteNote(user, personId, noteId) {
        await this.validatePersonInScope(user, personId);
        return this.prisma.personNote.update({
            where: { noteId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
                updatedByUserId: user.userId,
            },
        });
    }
};
exports.PersonsService = PersonsService;
exports.PersonsService = PersonsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], PersonsService);
//# sourceMappingURL=persons.service.js.map