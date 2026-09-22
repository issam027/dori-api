"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
const error_codes_enum_1 = require("./error-codes.enum");
class AppException extends common_1.HttpException {
    code;
    translationKey;
    translationParams;
    responseData;
    constructor(code, translationParams = {}, responseData = null, overrideHttpStatus, overrideTranslationKey) {
        const catalogEntry = error_codes_enum_1.ERROR_CATALOG[code] || {
            httpStatus: 500,
            translationKey: 'errors.internal_error',
        };
        const httpStatus = overrideHttpStatus ?? catalogEntry.httpStatus;
        const translationKey = overrideTranslationKey ?? catalogEntry.translationKey;
        super({
            code,
            translationKey,
            translationParams,
            data: responseData,
        }, httpStatus);
        this.code = code;
        this.translationKey = translationKey;
        this.translationParams = translationParams;
        this.responseData = responseData;
    }
}
exports.AppException = AppException;
//# sourceMappingURL=app.exception.js.map