import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, catchError, concatMap, from, of, throwError } from 'rxjs';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { safeErrorName } from '../logging/safe-error';
import { AUDIT_EVENT_KEY, AuditEventDefinition } from './audit-event.decorator';
import { AuditOutcome, AuditRepository } from './audit.repository';

type AuditedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly repository: AuditRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const definition = this.reflector.getAllAndOverride<AuditEventDefinition>(
      AUDIT_EVENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!definition || context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    return next.handle().pipe(
      concatMap((value) =>
        from(this.record(request, definition, 'success', null)).pipe(
          concatMap(() => of(value)),
        ),
      ),
      catchError((error: unknown) =>
        from(
          this.record(request, definition, 'failure', safeErrorName(error)),
        ).pipe(concatMap(() => throwError(() => error))),
      ),
    );
  }

  private async record(
    request: AuditedRequest,
    definition: AuditEventDefinition,
    outcome: AuditOutcome,
    failureType: string | null,
  ): Promise<void> {
    try {
      await this.repository.append({
        actorUserId: request.user?.userId ?? null,
        action: definition.action,
        targetType: definition.targetType,
        targetId: this.param(request, definition.targetParam),
        secondaryTargetId:
          this.param(request, definition.secondaryTargetParam) ??
          this.bodyIdentifier(request, definition.secondaryTargetBodyField),
        outcome,
        correlationId: this.header(request, 'x-correlation-id'),
        requestMethod: request.method,
        requestPath: request.route?.path ?? request.path,
        failureType,
      });
    } catch (error: unknown) {
      // Audit is fail-open so a temporary audit storage problem does not turn an
      // already committed business mutation into an ambiguous HTTP failure.
      this.logger.error(
        `Audit persistence failed type=${safeErrorName(error)} action=${definition.action}`,
      );
    }
  }

  private param(request: AuditedRequest, name?: string): string | null {
    if (!name) return null;
    const value = request.params?.[name];
    return value == null ? null : String(value).slice(0, 128);
  }

  private header(request: AuditedRequest, name: string): string | null {
    const value = request.headers[name];
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized ? String(normalized).slice(0, 128) : null;
  }

  private bodyIdentifier(
    request: AuditedRequest,
    field?: string,
  ): string | null {
    if (!field || typeof request.body !== 'object' || request.body === null) {
      return null;
    }
    const value = (request.body as Record<string, unknown>)[field];
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const normalized = String(value);
    return /^[A-Za-z0-9_-]{1,128}$/.test(normalized) ? normalized : null;
  }
}
