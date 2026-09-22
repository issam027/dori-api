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
exports.HealthResponseDto = exports.HealthServicesStatusDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class HealthServicesStatusDto {
    database;
    api;
    static _OPENAPI_METADATA_FACTORY() {
        return { database: { required: true, type: () => String }, api: { required: true, type: () => String } };
    }
}
exports.HealthServicesStatusDto = HealthServicesStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'up', description: 'Statut de la connexion PostgreSQL' }),
    __metadata("design:type", String)
], HealthServicesStatusDto.prototype, "database", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'up', description: "Statut du serveur d'API NestJS" }),
    __metadata("design:type", String)
], HealthServicesStatusDto.prototype, "api", void 0);
class HealthResponseDto {
    status;
    timestamp;
    services;
    static _OPENAPI_METADATA_FACTORY() {
        return { status: { required: true, type: () => String }, timestamp: { required: true, type: () => String }, services: { required: true, type: () => require("./health-response.dto").HealthServicesStatusDto } };
    }
}
exports.HealthResponseDto = HealthResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ok', enum: ['ok', 'degraded'], description: 'État global du système' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T10:00:00.000Z', description: 'Horodatage ISO de la vérification' }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: HealthServicesStatusDto, description: 'Détail de santé des sous-systèmes' }),
    __metadata("design:type", HealthServicesStatusDto)
], HealthResponseDto.prototype, "services", void 0);
//# sourceMappingURL=health-response.dto.js.map