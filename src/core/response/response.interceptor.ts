import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  code: string;
  translationKey: string | null;
  translationParams: Record<string, unknown>;
  data: T;
}

export const SKIP_RESPONSE_ENVELOPE_KEY = 'skipResponseEnvelope';
export const SkipResponseEnvelope = () =>
  SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipEnvelope) {
      return next.handle() as Observable<StandardResponse<T>>;
    }
    return next.handle().pipe(
      map((data) => {
        // If the service already returned an envelope (e.g. QUEUE_EMPTY), pass it through
        if (
          data !== null &&
          typeof data === 'object' &&
          'code' in (data as object)
        ) {
          return data as unknown as StandardResponse<T>;
        }
        return {
          code: 'OK',
          translationKey: null,
          translationParams: {},
          data,
        };
      }),
    );
  }
}
