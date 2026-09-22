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
exports.SitesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let SitesService = class SitesService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    async findAll(user, pagination) {
        const allowedSiteIds = await this.scopeService.getAllowedSiteIds(user);
        const whereClause = { isActive: true };
        if (allowedSiteIds !== null) {
            whereClause.siteId = { in: allowedSiteIds };
        }
        const [items, total] = await Promise.all([
            this.prisma.site.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { siteName: 'asc' },
            }),
            this.prisma.site.count({ where: whereClause }),
        ]);
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findById(user, siteId) {
        await this.scopeService.validateSiteScope(user, siteId);
        const site = await this.prisma.site.findFirst({
            where: { siteId, isActive: true },
        });
        if (!site) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.SITE_NOT_FOUND, { siteId });
        }
        return site;
    }
    async create(dto) {
        return this.prisma.site.create({
            data: dto,
        });
    }
    async update(user, siteId, dto) {
        await this.scopeService.validateSiteScope(user, siteId);
        return this.prisma.site.update({
            where: { siteId },
            data: dto,
        });
    }
    async delete(user, siteId) {
        await this.scopeService.validateSiteScope(user, siteId);
        const now = this.clockService.now();
        return this.prisma.$transaction(async (tx) => {
            await tx.queue.updateMany({
                where: { siteId, isActive: true },
                data: {
                    isActive: false,
                    deletedAt: now,
                },
            });
            return tx.site.update({
                where: { siteId },
                data: {
                    isActive: false,
                    deletedAt: now,
                },
            });
        });
    }
    async getManagers(user, siteId) {
        await this.scopeService.validateSiteScope(user, siteId);
        const userSites = await this.prisma.userSite.findMany({
            where: { siteId },
            include: {
                user: {
                    select: {
                        userId: true,
                        username: true,
                        email: true,
                        userType: true,
                    },
                },
            },
        });
        return userSites.map((us) => us.user);
    }
    async assignManager(user, siteId, targetUserId) {
        await this.scopeService.validateSiteScope(user, siteId);
        return this.prisma.userSite.upsert({
            where: { userId_siteId: { userId: targetUserId, siteId } },
            update: {},
            create: { userId: targetUserId, siteId },
        });
    }
    async unassignManager(user, siteId, targetUserId) {
        await this.scopeService.validateSiteScope(user, siteId);
        await this.prisma.userSite.deleteMany({
            where: { userId: targetUserId, siteId },
        });
        return { success: true };
    }
};
exports.SitesService = SitesService;
exports.SitesService = SitesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], SitesService);
//# sourceMappingURL=sites.service.js.map