import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const RESPONSE_MESSAGE_KEY = 'response_message_key';

/**
 * Décorateur optionnel pour spécifier une translationKey et translationParams sur un endpoint de succès
 */
export const ResponseMessage = (translationKey: string, translationParams: Record<string, any> = {}) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, { translationKey, translationParams });

export interface StandardResponse<T> {
  code: string;
  translationKey: string | null;
  translationParams: Record<string, any>;
  data: T;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const meta = this.reflector.get<{ translationKey: string; translationParams: Record<string, any> }>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((resData) => {
        // Si la réponse est déjà au format standard, ne pas la ré-envelopper
        if (resData && typeof resData === 'object' && 'code' in resData && 'data' in resData) {
          return {
            code: resData.code || 'OK',
            translationKey: resData.translationKey ?? meta?.translationKey ?? null,
            translationParams: resData.translationParams ?? meta?.translationParams ?? {},
            data: resData.data,
          };
        }

        return {
          code: 'OK',
          translationKey: meta?.translationKey ?? null,
          translationParams: meta?.translationParams ?? {},
          data: resData !== undefined ? resData : null,
        };
      }),
    );
  }
}
