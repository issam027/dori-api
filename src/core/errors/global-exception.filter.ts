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

      // Handle 429 Rate Limiting per §6.9 & §7.3
      if (status === 429) {
        return response.status(429).json({
          code: 'RATE_LIMITED',
          translationKey: 'errors.rate_limited',
          translationParams: {},
          data: null,
        });
      }

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

      return response.status(status).json({
        code: 'ERROR',
        translationKey: null,
        translationParams: {},
        data:
          typeof exRes === 'string' ? { message: exRes } : (exRes as unknown),
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
