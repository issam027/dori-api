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
exports.QueueDailyReportResponseDto = exports.QueueDailyMetricsDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class QueueDailyMetricsDto {
    totalRegistrations;
    servedCount;
    noShowCount;
    waitingCount;
    expiredCount;
    noShowRatePercent;
    averageWaitTimeActualMinutes;
    static _OPENAPI_METADATA_FACTORY() {
        return { totalRegistrations: { required: true, type: () => Number }, servedCount: { required: true, type: () => Number }, noShowCount: { required: true, type: () => Number }, waitingCount: { required: true, type: () => Number }, expiredCount: { required: true, type: () => Number }, noShowRatePercent: { required: true, type: () => Number }, averageWaitTimeActualMinutes: { required: true, type: () => Number } };
    }
}
exports.QueueDailyMetricsDto = QueueDailyMetricsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 45, description: "Nombre total d'inscriptions sur la journée" }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "totalRegistrations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 40, description: 'Nombre de clients servis avec succès' }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "servedCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, description: 'Nombre de clients déclarés absents (no-show)' }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "noShowCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Nombre de clients encore en attente' }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "waitingCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Nombre de clients ou RDV expirés' }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "expiredCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 7, description: "Taux d'absence / no-show en pourcentage" }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "noShowRatePercent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12, description: "Temps moyen d'attente effectif en minutes" }),
    __metadata("design:type", Number)
], QueueDailyMetricsDto.prototype, "averageWaitTimeActualMinutes", void 0);
class QueueDailyReportResponseDto {
    queueId;
    queueCode;
    businessDate;
    metrics;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, queueCode: { required: true, type: () => String }, businessDate: { required: true, type: () => String }, metrics: { required: true, type: () => require("./report-response.dto").QueueDailyMetricsDto } };
    }
}
exports.QueueDailyReportResponseDto = QueueDailyReportResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueDailyReportResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], QueueDailyReportResponseDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20' }),
    __metadata("design:type", String)
], QueueDailyReportResponseDto.prototype, "businessDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: QueueDailyMetricsDto }),
    __metadata("design:type", QueueDailyMetricsDto)
], QueueDailyReportResponseDto.prototype, "metrics", void 0);
//# sourceMappingURL=report-response.dto.js.map