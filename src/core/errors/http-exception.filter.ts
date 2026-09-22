import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from './app.exception';
import { ErrorCode } from './error-codes.enum';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_SERVER_ERROR;
    let translationKey = 'errors.internal_error';
    let translationParams: Record<string, any> = {};
    let data: any = null;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      translationKey = exception.translationKey;
      translationParams = exception.translationParams;
      data = exception.responseData;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;

      if (status === HttpStatus.BAD_REQUEST) {
        code = ErrorCode.VALIDATION_ERROR;
        translationKey = 'errors.validation_error';
        data = Array.isArray(res?.message) ? res.message : res;
      } else if (status === HttpStatus.UNAUTHORIZED) {
        code = ErrorCode.UNAUTHENTICATED;
        translationKey = 'errors.unauthenticated';
      } else if (status === HttpStatus.FORBIDDEN) {
        code = ErrorCode.FORBIDDEN_PERMISSION;
        translationKey = 'errors.forbidden_permission';
      } else if (status === HttpStatus.NOT_FOUND) {
        code = ErrorCode.QUEUE_NOT_FOUND;
        translationKey = 'errors.not_found';
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = ErrorCode.RATE_LIMITED;
        translationKey = 'errors.rate_limited';
      } else {
        code = ErrorCode.INTERNAL_SERVER_ERROR;
        translationKey = 'errors.internal_error';
        data = res?.message || null;
      }
    } else {
      this.logger.error('Unhandled Exception:', exception);
    }

    response.status(status).json({
      code,
      translationKey,
      translationParams,
      data,
    });
  }
}
