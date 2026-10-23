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
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const method = request.method.toUpperCase();
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const definition =
      this.reflector.getAllAndOverride<AuditEventDefinition>(AUDIT_EVENT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? this.defaultDefinition(context, request);
    return next.handle().pipe(
      concatMap((value) =>
        from(this.record(request, definition, 'success', null, value)).pipe(
          concatMap(() => of(value)),
        ),
      ),
      catchError((error: unknown) =>
        from(
          this.record(
            request,
            definition,
            'failure',
            safeErrorName(error),
            null,
          ),
        ).pipe(concatMap(() => throwError(() => error))),
      ),
    );
  }

  private async record(
    request: AuditedRequest,
    definition: AuditEventDefinition,
    outcome: AuditOutcome,
    failureType: string | null,
    responseValue: unknown,
  ): Promise<void> {
    try {
      await this.repository.append({
        actorUserId: request.user?.userId ?? null,
        action: definition.action,
        targetType: definition.targetType,
        targetId:
          this.param(request, definition.targetParam) ??
          this.responseIdentifier(
            responseValue,
            definition.targetResponseField,
          ),
        secondaryTargetId:
          this.param(request, definition.secondaryTargetParam) ??
          this.bodyIdentifier(request, definition.secondaryTargetBodyField),
        outcome,
        correlationId: this.header(request, 'x-correlation-id'),
        requestMethod: request.method,
        requestPath: request.route?.path ?? request.path,
        failureType,
        siteScopeId: this.queryPositiveInteger(
          request,
          definition.siteScopeQueryField,
        ),
      });
    } catch (error: unknown) {
      // Audit is fail-open so a temporary audit storage problem does not turn an
      // already committed business mutation into an ambiguous HTTP failure.
      this.logger.error(
        `Audit persistence failed type=${safeErrorName(error)} action=${definition.action}`,
      );
    }
  }

  private defaultDefinition(
    context: ExecutionContext,
    request: AuditedRequest,
  ): AuditEventDefinition {
    const controller =
      context.getClass()?.name?.replace(/Controller$/, '') ?? 'http';
    const handler = context.getHandler()?.name ?? request.method.toLowerCase();
    const target = this.inferTarget(request, context.getClass()?.name);
    return {
      action:
        controller.charAt(0).toLowerCase() +
        controller.slice(1) +
        '.' +
        handler,
      targetType: target.type,
      targetParam: target.param,
      targetResponseField: target.responseField,
    };
  }

  private inferTarget(
    request: AuditedRequest,
    controllerName?: string,
  ): {
    type: string;
    param?: string;
    responseField?: string;
  } {
    const candidates: Array<[string, string]> = [
      ['queueId', 'queue'],
      ['registrationId', 'registration'],
      ['notificationId', 'notification'],
      ['sessionId', 'session'],
      ['ruleId', 'notification_rule'],
      ['noteId', 'note'],
      ['translationId', 'translation'],
      ['tierId', 'service_tier'],
      ['personId', 'person'],
      ['siteId', 'site'],
      ['userId', 'user'],
      ['roleId', 'role'],
    ];
    for (const [param, type] of candidates) {
      if (request.params?.[param] != null) return { type, param };
    }

    const controllerResource: Record<string, [string, string]> = {
      AuthController: ['user', 'user.userId'],
      NotificationsController: ['notification', 'notificationId'],
      PersonsController: ['person', 'personId'],
      QueuesController: ['queue', 'queueId'],
      RegistrationsController: ['registration', 'registrationId'],
      ServiceTiersController: ['service_tier', 'tierId'],
      SitesController: ['site', 'siteId'],
      TranslationsController: ['translation', 'translationId'],
      UsersController: ['user', 'userId'],
    };
    const resource = controllerName
      ? controllerResource[controllerName]
      : undefined;
    return resource
      ? { type: resource[0], responseField: resource[1] }
      : { type: 'http_operation' };
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

  private responseIdentifier(value: unknown, field?: string): string | null {
    if (!field || typeof value !== 'object' || value === null) return null;
    const readPath = (root: unknown, path: string): unknown =>
      path.split('.').reduce<unknown>((current, segment) => {
        if (typeof current !== 'object' || current === null) return undefined;
        return (current as Record<string, unknown>)[segment];
      }, root);
    const direct = readPath(value, field);
    if (typeof direct === 'string' || typeof direct === 'number') {
      return this.safeIdentifier(direct);
    }
    const data = (value as Record<string, unknown>).data;
    const nested = readPath(data, field);
    return typeof nested === 'string' || typeof nested === 'number'
      ? this.safeIdentifier(nested)
      : null;
  }
  private safeIdentifier(value: string | number): string | null {
    const normalized = String(value);
    return /^[A-Za-z0-9_-]{1,128}$/.test(normalized) ? normalized : null;
  }

  private queryPositiveInteger(
    request: AuditedRequest,
    field?: string,
  ): number | null {
    if (!field) return null;
    const value = request.query?.[field];
    const normalized = Array.isArray(value) ? value[0] : value;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
}
