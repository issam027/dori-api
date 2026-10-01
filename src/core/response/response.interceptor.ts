import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  code: string;
  translationKey: string | null;
  translationParams: Record<string, unknown>;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
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
