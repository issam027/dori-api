import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DoriException } from './dori.exception';
import { safeErrorName } from '../logging/safe-error';
import { ERROR_CATALOG } from './error-catalog';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string) ?? '';

    if (exception instanceof DoriException) {
      const body = exception.getResponse() as Record<string, unknown>;
      return response.status(exception.getStatus()).json(body);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exRes = exception.getResponse();

      // Handle class-validator ValidationPipe errors
      if (
        typeof exRes === 'object' &&
        exRes !== null &&
        'message' in exRes &&
        Array.isArray((exRes as { message: unknown[] }).message)
      ) {
        return response.status(400).json({
          code: 'VALIDATION_ERROR',
          translationKey: 'errors.validation_error',
          translationParams: {},
          data: { errors: (exRes as { message: unknown[] }).message },
        });
      }

      const codeByStatus: Record<number, string> = {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHENTICATED',
        403: 'FORBIDDEN_PERMISSION',
        404: 'RESOURCE_NOT_FOUND',
        409: 'CONFLICT',
        429: 'RATE_LIMITED',
      };
      const code = codeByStatus[status] ?? 'INTERNAL_ERROR';
      return response.status(status).json({
        code,
        translationKey: ERROR_CATALOG[code].translationKey,
        translationParams: {},
        data: null,
      });
    }

    this.logger.error(
      `Unhandled exception correlationId=${correlationId || 'none'} type=${safeErrorName(exception)}`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      translationKey: 'errors.internal_error',
      translationParams: {},
      data: null,
    });
  }
}
