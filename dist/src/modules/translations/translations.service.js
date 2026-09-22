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
exports.TranslationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let TranslationsService = class TranslationsService {
    prisma;
    clockService;
    constructor(prisma, clockService) {
        this.prisma = prisma;
        this.clockService = clockService;
    }
    validateExpectedParams(content, expectedParams) {
        if (!expectedParams)
            return;
        const matches = content.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
        const extractedParams = matches.map((m) => m.replace(/[\{\}]/g, ''));
        const expectedSet = new Set(expectedParams);
        const extractedSet = new Set(extractedParams);
        for (const p of extractedSet) {
            if (!expectedSet.has(p)) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TRANSLATION_PARAM_MISMATCH, {
                    unexpectedParam: p,
                    expected: expectedParams,
                });
            }
        }
        for (const p of expectedSet) {
            if (!extractedSet.has(p)) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.TRANSLATION_PARAM_MISMATCH, {
                    missingParam: p,
                    expected: expectedParams,
                });
            }
        }
    }
    async incrementVersion(category) {
        const record = await this.prisma.translationVersion.upsert({
            where: { category },
            update: {
                version: { increment: 1 },
                updatedAt: this.clockService.now(),
            },
            create: {
                category,
                version: 1,
            },
        });
        return record.version;
    }
    async getBundle(locale = 'fr', category = 'ihm') {
        const [versionRecord, translations] = await Promise.all([
            this.prisma.translationVersion.findUnique({ where: { category } }),
            this.prisma.translation.findMany({
                where: { category, locale, isActive: true },
                select: { translationKey: true, content: true },
            }),
        ]);
        const entries = {};
        translations.forEach((t) => {
            entries[t.translationKey] = t.content;
        });
        return {
            locale,
            category,
            version: versionRecord?.version || 1,
            entries,
        };
    }
    async findAll(pagination, category, locale, key) {
        const whereClause = { isActive: true };
        if (category)
            whereClause.category = category;
        if (locale)
            whereClause.locale = locale;
        if (key)
            whereClause.translationKey = { contains: key };
        const [items, total] = await Promise.all([
            this.prisma.translation.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: [{ category: 'asc' }, { translationKey: 'asc' }],
            }),
            this.prisma.translation.count({ where: whereClause }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async create(dto) {
        this.validateExpectedParams(dto.content, dto.expectedParams);
        const translation = await this.prisma.translation.create({
            data: {
                translationKey: dto.translationKey,
                category: dto.category,
                locale: dto.locale,
                content: dto.content,
                expectedParams: dto.expectedParams || [],
            },
        });
        await this.incrementVersion(dto.category);
        return translation;
    }
    async update(translationId, dto) {
        const existing = await this.prisma.translation.findUnique({ where: { translationId } });
        if (!existing)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR);
        const expected = dto.expectedParams ?? existing.expectedParams;
        const content = dto.content ?? existing.content;
        this.validateExpectedParams(content, expected);
        const updated = await this.prisma.translation.update({
            where: { translationId },
            data: {
                content: dto.content,
                expectedParams: dto.expectedParams,
            },
        });
        await this.incrementVersion(existing.category);
        return updated;
    }
    async delete(translationId) {
        const existing = await this.prisma.translation.findUnique({ where: { translationId } });
        if (!existing)
            return { success: true };
        await this.prisma.translation.update({
            where: { translationId },
            data: {
                isActive: false,
                deletedAt: this.clockService.now(),
            },
        });
        await this.incrementVersion(existing.category);
        return { success: true };
    }
};
exports.TranslationsService = TranslationsService;
exports.TranslationsService = TranslationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clock_service_1.ClockService])
], TranslationsService);
//# sourceMappingURL=translations.service.js.map