"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CATALOG = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["UNAUTHENTICATED"] = "UNAUTHENTICATED";
    ErrorCode["FORBIDDEN_PERMISSION"] = "FORBIDDEN_PERMISSION";
    ErrorCode["FORBIDDEN_ROLE_ESCALATION"] = "FORBIDDEN_ROLE_ESCALATION";
    ErrorCode["QUEUE_NOT_FOUND"] = "QUEUE_NOT_FOUND";
    ErrorCode["REGISTRATION_NOT_FOUND"] = "REGISTRATION_NOT_FOUND";
    ErrorCode["SITE_NOT_FOUND"] = "SITE_NOT_FOUND";
    ErrorCode["PERSON_NOT_FOUND"] = "PERSON_NOT_FOUND";
    ErrorCode["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ErrorCode["THREAD_OCCUPIED"] = "THREAD_OCCUPIED";
    ErrorCode["THREAD_UNAVAILABLE"] = "THREAD_UNAVAILABLE";
    ErrorCode["SESSION_ALREADY_OPEN"] = "SESSION_ALREADY_OPEN";
    ErrorCode["QUEUE_EMPTY"] = "QUEUE_EMPTY";
    ErrorCode["TIER_NOT_OFFERED_BY_QUEUE"] = "TIER_NOT_OFFERED_BY_QUEUE";
    ErrorCode["TIER_IS_SYSTEM"] = "TIER_IS_SYSTEM";
    ErrorCode["DUPLICATE_ACTIVE_REGISTRATION"] = "DUPLICATE_ACTIVE_REGISTRATION";
    ErrorCode["APPOINTMENT_SLOT_FULL"] = "APPOINTMENT_SLOT_FULL";
    ErrorCode["APPOINTMENT_EXPIRED"] = "APPOINTMENT_EXPIRED";
    ErrorCode["APPOINTMENTS_DISABLED"] = "APPOINTMENTS_DISABLED";
    ErrorCode["REGISTRATION_NOT_IN_PROGRESS"] = "REGISTRATION_NOT_IN_PROGRESS";
    ErrorCode["REGISTRATION_CLOSED"] = "REGISTRATION_CLOSED";
    ErrorCode["TRANSLATION_PARAM_MISMATCH"] = "TRANSLATION_PARAM_MISMATCH";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
exports.ERROR_CATALOG = {
    [ErrorCode.VALIDATION_ERROR]: {
        httpStatus: 400,
        translationKey: 'errors.validation_error',
    },
    [ErrorCode.UNAUTHENTICATED]: {
        httpStatus: 401,
        translationKey: 'errors.unauthenticated',
    },
    [ErrorCode.FORBIDDEN_PERMISSION]: {
        httpStatus: 403,
        translationKey: 'errors.forbidden_permission',
    },
    [ErrorCode.FORBIDDEN_ROLE_ESCALATION]: {
        httpStatus: 403,
        translationKey: 'errors.forbidden_role_escalation',
    },
    [ErrorCode.QUEUE_NOT_FOUND]: {
        httpStatus: 404,
        translationKey: 'errors.queue_not_found',
    },
    [ErrorCode.REGISTRATION_NOT_FOUND]: {
        httpStatus: 404,
        translationKey: 'errors.registration_not_found',
    },
    [ErrorCode.SITE_NOT_FOUND]: {
        httpStatus: 404,
        translationKey: 'errors.site_not_found',
    },
    [ErrorCode.PERSON_NOT_FOUND]: {
        httpStatus: 404,
        translationKey: 'errors.person_not_found',
    },
    [ErrorCode.USER_NOT_FOUND]: {
        httpStatus: 404,
        translationKey: 'errors.user_not_found',
    },
    [ErrorCode.THREAD_OCCUPIED]: {
        httpStatus: 409,
        translationKey: 'errors.thread_occupied',
    },
    [ErrorCode.THREAD_UNAVAILABLE]: {
        httpStatus: 409,
        translationKey: 'errors.thread_unavailable',
    },
    [ErrorCode.SESSION_ALREADY_OPEN]: {
        httpStatus: 409,
        translationKey: 'errors.session_already_open',
    },
    [ErrorCode.QUEUE_EMPTY]: {
        httpStatus: 200,
        translationKey: 'queue.next.empty',
    },
    [ErrorCode.TIER_NOT_OFFERED_BY_QUEUE]: {
        httpStatus: 409,
        translationKey: 'errors.tier_not_offered',
    },
    [ErrorCode.TIER_IS_SYSTEM]: {
        httpStatus: 409,
        translationKey: 'errors.tier_is_system',
    },
    [ErrorCode.DUPLICATE_ACTIVE_REGISTRATION]: {
        httpStatus: 409,
        translationKey: 'errors.duplicate_active_registration',
    },
    [ErrorCode.APPOINTMENT_SLOT_FULL]: {
        httpStatus: 409,
        translationKey: 'errors.appointment_slot_full',
    },
    [ErrorCode.APPOINTMENT_EXPIRED]: {
        httpStatus: 409,
        translationKey: 'errors.appointment_expired',
    },
    [ErrorCode.APPOINTMENTS_DISABLED]: {
        httpStatus: 422,
        translationKey: 'errors.appointments_disabled',
    },
    [ErrorCode.REGISTRATION_NOT_IN_PROGRESS]: {
        httpStatus: 409,
        translationKey: 'errors.registration_not_in_progress',
    },
    [ErrorCode.REGISTRATION_CLOSED]: {
        httpStatus: 409,
        translationKey: 'errors.registration_closed',
    },
    [ErrorCode.TRANSLATION_PARAM_MISMATCH]: {
        httpStatus: 422,
        translationKey: 'errors.translation_param_mismatch',
    },
    [ErrorCode.TOKEN_EXPIRED]: {
        httpStatus: 410,
        translationKey: 'public.token_expired',
    },
    [ErrorCode.RATE_LIMITED]: {
        httpStatus: 429,
        translationKey: 'errors.rate_limited',
    },
    [ErrorCode.INTERNAL_SERVER_ERROR]: {
        httpStatus: 500,
        translationKey: 'errors.internal_error',
    },
};
//# sourceMappingURL=error-codes.enum.js.map