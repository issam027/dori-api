import { HttpException } from '@nestjs/common';
import { ErrorCode } from './error-codes.enum';
export declare class AppException extends HttpException {
    readonly code: ErrorCode;
    readonly translationKey: string;
    readonly translationParams: Record<string, any>;
    readonly responseData: any;
    constructor(code: ErrorCode, translationParams?: Record<string, any>, responseData?: any, overrideHttpStatus?: number, overrideTranslationKey?: string);
}
