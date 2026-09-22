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
exports.HealthController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../../core/database/prisma.service");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const health_response_dto_1 = require("./dto/health-response.dto");
let HealthController = class HealthController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async check() {
        let dbStatus = 'down';
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            dbStatus = 'up';
        }
        catch (e) {
            dbStatus = 'error';
        }
        return {
            status: dbStatus === 'up' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                database: dbStatus,
                api: 'up',
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, jwt_auth_guard_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Sonde de disponibilité de la base de données et des services' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: health_response_dto_1.HealthResponseDto,
        description: 'État de disponibilité de l’API et de la base de données',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Santé & Supervision'),
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthController);
//# sourceMappingURL=health.controller.js.map