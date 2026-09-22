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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const argon2 = require("argon2");
const prisma_service_1 = require("../../core/database/prisma.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const clock_service_1 = require("../../core/clock/clock.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
const roles_enum_1 = require("../../core/rbac/roles.enum");
const pagination_dto_1 = require("../../core/pagination/pagination.dto");
let UsersService = class UsersService {
    prisma;
    scopeService;
    clockService;
    constructor(prisma, scopeService, clockService) {
        this.prisma = prisma;
        this.scopeService = scopeService;
        this.clockService = clockService;
    }
    getMaxRank(roles) {
        let max = 0;
        for (const r of roles) {
            const rank = roles_enum_1.ROLE_RANKS[r] || 0;
            if (rank > max)
                max = rank;
        }
        return max;
    }
    async validateAntiEscalation(caller, targetUserId, targetRoleName) {
        const isRoot = caller.roles.includes('root');
        if (isRoot)
            return;
        const callerRank = this.getMaxRank(caller.roles);
        if (targetRoleName) {
            const targetRank = roles_enum_1.ROLE_RANKS[targetRoleName] || 0;
            if (!(0, roles_enum_1.canManageRole)(callerRank, targetRank, isRoot)) {
                throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.FORBIDDEN_ROLE_ESCALATION);
            }
        }
        if (targetUserId) {
            const targetUser = await this.prisma.user.findUnique({
                where: { userId: targetUserId },
                include: { userRoles: { include: { role: true } } },
            });
            if (targetUser) {
                const targetUserRoles = targetUser.userRoles.map((ur) => ur.role.roleName);
                const targetMaxRank = this.getMaxRank(targetUserRoles);
                if (!(0, roles_enum_1.canManageRole)(callerRank, targetMaxRank, isRoot)) {
                    throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.FORBIDDEN_ROLE_ESCALATION);
                }
            }
        }
    }
    async findAll(user, pagination, userType) {
        const whereClause = { isActive: true };
        if (userType)
            whereClause.userType = userType;
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where: whereClause,
                skip: pagination.skip,
                take: pagination.take,
                select: {
                    userId: true,
                    username: true,
                    email: true,
                    userType: true,
                    isActive: true,
                    languagePreference: true,
                    lastLogin: true,
                    createdAt: true,
                    userRoles: { include: { role: true } },
                },
                orderBy: { userId: 'asc' },
            }),
            this.prisma.user.count({ where: whereClause }),
        ]);
        const items = users.map((u) => ({
            ...u,
            roles: u.userRoles.map((ur) => ur.role.roleName),
            userRoles: undefined,
        }));
        return (0, pagination_dto_1.buildPaginatedResult)(items, total, pagination.page, pagination.pageSize);
    }
    async findById(user, targetUserId) {
        const targetUser = await this.prisma.user.findFirst({
            where: { userId: targetUserId, isActive: true },
            select: {
                userId: true,
                username: true,
                email: true,
                userType: true,
                isActive: true,
                languagePreference: true,
                lastLogin: true,
                createdAt: true,
                userRoles: { include: { role: true } },
                userSites: { include: { site: true } },
                userQueues: { include: { queue: true } },
            },
        });
        if (!targetUser)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.USER_NOT_FOUND, { userId: targetUserId });
        return {
            userId: targetUser.userId,
            username: targetUser.username,
            email: targetUser.email,
            userType: targetUser.userType,
            isActive: targetUser.isActive,
            languagePreference: targetUser.languagePreference,
            lastLogin: targetUser.lastLogin,
            createdAt: targetUser.createdAt,
            roles: targetUser.userRoles.map((ur) => ur.role.roleName),
            assignedSites: targetUser.userSites.map((us) => ({
                siteId: us.site.siteId,
                siteName: us.site.siteName,
            })),
            assignedQueues: targetUser.userQueues.map((uq) => ({
                queueId: uq.queue.queueId,
                queueCode: uq.queue.queueCode,
                queueName: uq.queue.queueName,
            })),
        };
    }
    async create(caller, dto) {
        await this.validateAntiEscalation(caller, undefined, dto.roleName);
        const role = await this.prisma.role.findUnique({ where: { roleName: dto.roleName } });
        if (!role)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'roleName' });
        const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
        });
        return this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    username: dto.username,
                    email: dto.email,
                    passwordHash,
                    userType: dto.userType || 'human',
                    languagePreference: dto.languagePreference || 'fr',
                    createdByUserId: caller.userId,
                },
            });
            await tx.userRole.create({
                data: {
                    userId: newUser.userId,
                    roleId: role.roleId,
                },
            });
            return {
                userId: newUser.userId,
                username: newUser.username,
                email: newUser.email,
                userType: newUser.userType,
                roles: [role.roleName],
            };
        });
    }
    async update(caller, targetUserId, dto) {
        await this.validateAntiEscalation(caller, targetUserId);
        return this.prisma.user.update({
            where: { userId: targetUserId },
            data: dto,
            select: {
                userId: true,
                username: true,
                email: true,
                userType: true,
                languagePreference: true,
            },
        });
    }
    async updateStatus(caller, targetUserId, dto) {
        await this.validateAntiEscalation(caller, targetUserId);
        const now = this.clockService.now();
        return this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { userId: targetUserId },
                data: {
                    isActive: dto.isActive,
                    deletedAt: dto.isActive ? null : now,
                },
            });
            if (!dto.isActive) {
                await tx.userSession.updateMany({
                    where: { userId: targetUserId, revokedAt: null },
                    data: {
                        revokedAt: now,
                        revokedReason: 'account_disabled',
                    },
                });
            }
            return { userId: updatedUser.userId, isActive: updatedUser.isActive };
        });
    }
    async resetPassword(caller, targetUserId, dto) {
        await this.validateAntiEscalation(caller, targetUserId);
        const now = this.clockService.now();
        const passwordHash = await argon2.hash(dto.newPassword, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
        });
        return this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { userId: targetUserId },
                data: {
                    passwordHash,
                    passwordChangedAt: now,
                    mustChangePassword: true,
                },
            });
            await tx.userSession.updateMany({
                where: { userId: targetUserId, revokedAt: null },
                data: {
                    revokedAt: now,
                    revokedReason: 'password_changed',
                },
            });
            return { success: true, mustChangePassword: true };
        });
    }
    async assignRole(caller, targetUserId, roleId) {
        const role = await this.prisma.role.findUnique({ where: { roleId } });
        if (!role)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'roleId' });
        await this.validateAntiEscalation(caller, targetUserId, role.roleName);
        await this.prisma.userRole.upsert({
            where: { userId_roleId: { userId: targetUserId, roleId } },
            update: {},
            create: { userId: targetUserId, roleId },
        });
        return { success: true, roleId, roleName: role.roleName };
    }
    async unassignRole(caller, targetUserId, roleId) {
        const role = await this.prisma.role.findUnique({ where: { roleId } });
        if (!role)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'roleId' });
        await this.validateAntiEscalation(caller, targetUserId, role.roleName);
        await this.prisma.userRole.deleteMany({
            where: { userId: targetUserId, roleId },
        });
        return { success: true };
    }
    async findAllRoles() {
        return this.prisma.role.findMany({
            where: { isActive: true },
            include: {
                rolePermissions: {
                    include: { permission: true },
                },
            },
            orderBy: { rank: 'asc' },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scope_service_1.ScopeService,
        clock_service_1.ClockService])
], UsersService);
//# sourceMappingURL=users.service.js.map