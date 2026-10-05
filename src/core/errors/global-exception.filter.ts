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
      const translations: Record<string, string> = {
        VALIDATION_ERROR: 'errors.validation_error',
        UNAUTHENTICATED: 'errors.unauthenticated',
        FORBIDDEN_PERMISSION: 'errors.forbidden_permission',
        RESOURCE_NOT_FOUND: 'errors.resource_not_found',
        CONFLICT: 'errors.conflict',
        RATE_LIMITED: 'errors.rate_limited',
        INTERNAL_ERROR: 'errors.internal_error',
      };

      return response.status(status).json({
        code,
        translationKey: translations[code],
        translationParams: {},
        data: null,
      });
    }

    this.logger.error(
      `Unhandled exception [${correlationId}]: ${String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      translationKey: 'errors.internal_error',
      translationParams: {},
      data: null,
    });
  }
}
