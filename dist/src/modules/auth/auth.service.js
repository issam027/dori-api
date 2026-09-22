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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const argon2 = require("argon2");
const crypto = require("crypto");
const prisma_service_1 = require("../../core/database/prisma.service");
const clock_service_1 = require("../../core/clock/clock.service");
const scope_service_1 = require("../../core/rbac/scope.service");
const app_exception_1 = require("../../core/errors/app.exception");
const error_codes_enum_1 = require("../../core/errors/error-codes.enum");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    clockService;
    scopeService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService, clockService, scopeService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.clockService = clockService;
        this.scopeService = scopeService;
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    async login(dto, ipAddress, userAgent) {
        const user = await this.prisma.user.findUnique({
            where: { username: dto.username },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!user || !user.isActive) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        const now = this.clockService.now();
        if (user.lockedUntil && user.lockedUntil > now) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED, {
                lockedUntil: user.lockedUntil.toISOString(),
            });
        }
        const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
        if (!isPasswordValid) {
            const failedAttempts = user.failedAttempts + 1;
            let lockedUntil = null;
            if (failedAttempts >= 5) {
                lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
            }
            await this.prisma.user.update({
                where: { userId: user.userId },
                data: {
                    failedAttempts,
                    lockedUntil,
                },
            });
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        await this.prisma.user.update({
            where: { userId: user.userId },
            data: {
                failedAttempts: 0,
                lockedUntil: null,
                lastLogin: now,
            },
        });
        const roles = user.userRoles.map((ur) => ur.role.roleName);
        const permissionSet = new Set();
        user.userRoles.forEach((ur) => {
            ur.role.rolePermissions.forEach((rp) => {
                if (rp.permission.isActive) {
                    permissionSet.add(rp.permission.permissionName);
                }
            });
        });
        const permissions = Array.from(permissionSet);
        const payload = {
            sub: user.userId,
            roles,
            permissions,
            userType: user.userType,
            jti: crypto.randomUUID(),
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: '3600s' });
        const rawRefreshToken = crypto.randomBytes(40).toString('hex');
        const refreshTokenHash = this.hashToken(rawRefreshToken);
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.userSession.create({
            data: {
                userId: user.userId,
                refreshTokenHash,
                issuedAt: now,
                expiresAt,
                ipAddress,
                userAgent,
            },
        });
        return {
            accessToken,
            refreshToken: rawRefreshToken,
            expiresIn: 3600,
            mustChangePassword: user.mustChangePassword,
            user: {
                userId: user.userId,
                username: user.username,
                email: user.email,
                roles,
                permissions,
                userType: user.userType,
            },
        };
    }
    async refresh(dto, ipAddress, userAgent) {
        const tokenHash = this.hashToken(dto.refreshToken);
        const session = await this.prisma.userSession.findUnique({
            where: { refreshTokenHash: tokenHash },
            include: {
                user: {
                    include: {
                        userRoles: {
                            include: {
                                role: {
                                    include: {
                                        rolePermissions: {
                                            include: {
                                                permission: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!session) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        const now = this.clockService.now();
        if (session.revokedAt !== null) {
            this.logger.warn(`Tentative de réutilisation d'un refresh token révoqué pour userId=${session.userId}`);
            await this.prisma.userSession.updateMany({
                where: { userId: session.userId, revokedAt: null },
                data: { revokedAt: now, revokedReason: 'admin' },
            });
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        if (session.expiresAt < now || !session.user.isActive) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        await this.prisma.userSession.update({
            where: { sessionId: session.sessionId },
            data: {
                revokedAt: now,
                revokedReason: 'rotation',
            },
        });
        const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
        const newRefreshTokenHash = this.hashToken(newRawRefreshToken);
        const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.userSession.create({
            data: {
                userId: session.userId,
                refreshTokenHash: newRefreshTokenHash,
                issuedAt: now,
                expiresAt: newExpiresAt,
                ipAddress,
                userAgent,
            },
        });
        const roles = session.user.userRoles.map((ur) => ur.role.roleName);
        const permissionSet = new Set();
        session.user.userRoles.forEach((ur) => {
            ur.role.rolePermissions.forEach((rp) => {
                if (rp.permission.isActive) {
                    permissionSet.add(rp.permission.permissionName);
                }
            });
        });
        const payload = {
            sub: session.user.userId,
            roles,
            permissions: Array.from(permissionSet),
            userType: session.user.userType,
            jti: crypto.randomUUID(),
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: '3600s' });
        return {
            accessToken,
            refreshToken: newRawRefreshToken,
            expiresIn: 3600,
        };
    }
    async logout(dto) {
        const tokenHash = this.hashToken(dto.refreshToken);
        await this.prisma.userSession.updateMany({
            where: { refreshTokenHash: tokenHash, revokedAt: null },
            data: {
                revokedAt: this.clockService.now(),
                revokedReason: 'logout',
            },
        });
        return { success: true };
    }
    async getMe(userContext) {
        const user = await this.prisma.user.findUnique({
            where: { userId: userContext.userId },
            select: {
                userId: true,
                username: true,
                email: true,
                userType: true,
                languagePreference: true,
                mustChangePassword: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        }
        const allowedSites = await this.scopeService.getAllowedSiteIds(userContext);
        const allowedQueues = await this.scopeService.getAllowedQueueIds(userContext);
        return {
            ...user,
            roles: userContext.roles,
            permissions: userContext.permissions,
            scope: {
                allSites: this.scopeService.isSystemUser(userContext),
                allowedSiteIds: allowedSites,
                allowedQueueIds: allowedQueues,
            },
        };
    }
    async changePassword(userId, dto) {
        const user = await this.prisma.user.findUnique({ where: { userId } });
        if (!user)
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.UNAUTHENTICATED);
        const isOldPasswordValid = await argon2.verify(user.passwordHash, dto.oldPassword);
        if (!isOldPasswordValid) {
            throw new app_exception_1.AppException(error_codes_enum_1.ErrorCode.VALIDATION_ERROR, { field: 'oldPassword' });
        }
        const newPasswordHash = await argon2.hash(dto.newPassword, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
        });
        const now = this.clockService.now();
        await this.prisma.user.update({
            where: { userId },
            data: {
                passwordHash: newPasswordHash,
                passwordChangedAt: now,
                mustChangePassword: false,
            },
        });
        await this.prisma.userSession.updateMany({
            where: { userId, revokedAt: null },
            data: {
                revokedAt: now,
                revokedReason: 'password_changed',
            },
        });
        return { success: true };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        clock_service_1.ClockService,
        scope_service_1.ScopeService])
], AuthService);
//# sourceMappingURL=auth.service.js.map