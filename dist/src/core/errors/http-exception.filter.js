"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("./app.exception");
const error_codes_enum_1 = require("./error-codes.enum");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR;
        let translationKey = 'errors.internal_error';
        let translationParams = {};
        let data = null;
        if (exception instanceof app_exception_1.AppException) {
            status = exception.getStatus();
            code = exception.code;
            translationKey = exception.translationKey;
            translationParams = exception.translationParams;
            data = exception.responseData;
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (status === common_1.HttpStatus.BAD_REQUEST) {
                code = error_codes_enum_1.ErrorCode.VALIDATION_ERROR;
                translationKey = 'errors.validation_error';
                data = Array.isArray(res?.message) ? res.message : res;
            }
            else if (status === common_1.HttpStatus.UNAUTHORIZED) {
                code = error_codes_enum_1.ErrorCode.UNAUTHENTICATED;
                translationKey = 'errors.unauthenticated';
            }
            else if (status === common_1.HttpStatus.FORBIDDEN) {
                code = error_codes_enum_1.ErrorCode.FORBIDDEN_PERMISSION;
                translationKey = 'errors.forbidden_permission';
            }
            else if (status === common_1.HttpStatus.NOT_FOUND) {
                code = error_codes_enum_1.ErrorCode.QUEUE_NOT_FOUND;
                translationKey = 'errors.not_found';
            }
            else if (status === common_1.HttpStatus.TOO_MANY_REQUESTS) {
                code = error_codes_enum_1.ErrorCode.RATE_LIMITED;
                translationKey = 'errors.rate_limited';
            }
            else {
                code = error_codes_enum_1.ErrorCode.INTERNAL_SERVER_ERROR;
                translationKey = 'errors.internal_error';
                data = res?.message || null;
            }
        }
        else {
            this.logger.error('Unhandled Exception:', exception);
        }
        response.status(status).json({
            code,
            translationKey,
            translationParams,
            data,
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map