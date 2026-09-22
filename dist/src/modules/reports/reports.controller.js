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
exports.ReportsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reports_service_1 = require("./reports.service");
const jwt_auth_guard_1 = require("../../core/auth/jwt-auth.guard");
const permissions_guard_1 = require("../../core/rbac/permissions.guard");
const permissions_decorator_1 = require("../../core/rbac/permissions.decorator");
const current_user_decorator_1 = require("../../core/auth/current-user.decorator");
const api_standard_response_decorator_1 = require("../../core/swagger/api-standard-response.decorator");
const report_response_dto_1 = require("./dto/report-response.dto");
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getQueueDailyReport(user, queueId, dateStr) {
        return this.reportsService.getQueueDailyReport(user, queueId, dateStr);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('queues/:queueId/daily'),
    (0, permissions_decorator_1.RequirePermission)('report_view'),
    (0, swagger_1.ApiOperation)({ summary: "Rapport quotidien d'une file (volumétrie, attente, absences)" }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false, example: '2026-09-20' }),
    (0, api_standard_response_decorator_1.ApiStandardResponse)({
        type: report_response_dto_1.QueueDailyReportResponseDto,
        description: `Métriques journalières consolidées pour la file : volume, taux d'absence, temps d'attente moyen`,
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('queueId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getQueueDailyReport", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('Rapports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map