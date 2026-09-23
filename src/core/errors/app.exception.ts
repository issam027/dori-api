import { HttpException } from '@nestjs/common';
import { ErrorCode, ERROR_CATALOG } from './error-codes.enum';

/**
 * Exception métier typée pour DORI
 */
export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly translationKey: string;
  public readonly translationParams: Record<string, any>;
  public readonly responseData: any;

  constructor(
    code: ErrorCode,
    translationParams: Record<string, any> = {},
    responseData: any = null,
    overrideHttpStatus?: number,
    overrideTranslationKey?: string,
  ) {
    const catalogEntry = ERROR_CATALOG[code] || {
      httpStatus: 500,
      translationKey: 'errors.internal_error',
    };

    const httpStatus = overrideHttpStatus ?? catalogEntry.httpStatus;
    const translationKey = overrideTranslationKey ?? catalogEntry.translationKey;

    super(
      {
        code,
        translationKey,
        translationParams,
        data: responseData,
      },
      httpStatus,
    );

    this.code = code;
    this.translationKey = translationKey;
    this.translationParams = translationParams;
    this.responseData = responseData;
  }
}
