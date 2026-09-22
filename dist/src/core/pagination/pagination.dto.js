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
exports.PaginationQueryDto = void 0;
exports.buildPaginatedResult = buildPaginatedResult;
const openapi = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class PaginationQueryDto {
    page = 1;
    pageSize = 25;
    sort;
    get skip() {
        return (this.page - 1) * this.pageSize;
    }
    get take() {
        return this.pageSize;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { page: { required: true, type: () => Number, default: 1, minimum: 1 }, pageSize: { required: true, type: () => Number, default: 25, minimum: 1, maximum: 100 }, sort: { required: false, type: () => String } };
    }
}
exports.PaginationQueryDto = PaginationQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PaginationQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 25, minimum: 1, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PaginationQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Format: field:asc ou field:desc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaginationQueryDto.prototype, "sort", void 0);
function buildPaginatedResult(items, total, page, pageSize) {
    return {
        items,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}
//# sourceMappingURL=pagination.dto.js.map