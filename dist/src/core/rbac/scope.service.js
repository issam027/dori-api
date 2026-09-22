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
exports.ScopeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const app_exception_1 = require("../errors/app.exception");
const error_codes_enum_1 = require("../errors/error-codes.enum");
let ScopeService = class ScopeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isSystemUser(user) {
        return user.roles.includes('root') || user.roles.includes('admin');
    }
    async getAllowedSiteIds(user) {
        if (this.isSystemUser(user)) {
            return null;
        }
        if (user.roles.includes('manager')) {
            const userSites = await this.prisma.userSite.findMany({
                where: { userId: user.userId },
                select: { siteId: true },
            });
            return userSites.map((s) => s.siteId);
        }
        const userQueues = await this.prisma.userQueue.findMany({
            where: { userId: user.userId },
            include: { queue: { select: { siteId: true } } },
        });
        const siteIds = Array.from(new Set(userQueues.map((q) => q.queue.siteId)));
        return siteIds;
    }
    async getAllowedQueueIds(user) {
        if (this.isSystemUser(user)) {
            return null;
        }
        if (user.roles.includes('manager')) {
            const siteIds = await this.getAllowedSiteIds(user);
            if (!siteIds || siteIds.length === 0)
                return [];
            const queues = await this.prisma.queue.findMany({
                where: { siteId: { in: siteIds }, isActive: true },
                select: { queueId: true },
            });
            return queues.map((q) => q.queueId);
        }
        const userQueues = await this.prisma.userQueue.findMany({
            where: { userId: user.userId },
            select: { queueId: true },
        });
        return userQueues.map((uq) => uq.queueId);
    }
    async validateSiteScope(user, siteId) {
        if (this.isSystemUser(user))
            return;
        const allowedSites = await this.getAllowedSiteIds(user);
        if (!allowedSites || !allowedSites.includes(siteId)) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.SITE_NOT_FOUND, { siteId });
        }
    }
    async validateQueueScope(user, queueId) {
        if (this.isSystemUser(user))
            return;
        const allowedQueues = await this.getAllowedQueueIds(user);
        if (!allowedQueues || !allowedQueues.includes(queueId)) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND, { queueId });
        }
    }
};
exports.ScopeService = ScopeService;
exports.ScopeService = ScopeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScopeService);
//# sourceMappingURL=scope.service.js.map