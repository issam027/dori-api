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
exports.OpenSessionDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class OpenSessionDto {
    threadNumber;
    mode = 'active';
    takeOver = false;
    static _OPENAPI_METADATA_FACTORY() {
        return { threadNumber: { required: false, type: () => Number, minimum: 1 }, mode: { required: true, type: () => String, default: "active", enum: ['active', 'consultation_only'] }, takeOver: { required: true, type: () => Boolean, default: false } };
    }
}
exports.OpenSessionDto = OpenSessionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, description: 'Numéro de guichet demandé (1..threadCount)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OpenSessionDto.prototype, "threadNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['active', 'consultation_only'], default: 'active' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'consultation_only']),
    __metadata("design:type", String)
], OpenSessionDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'true pour forcer la reprise du guichet occupé (§6.2)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], OpenSessionDto.prototype, "takeOver", void 0);
//# sourceMappingURL=session.dto.js.map