import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z0-9])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

const SENSITIVE_FIELDS = new Set([
  'password_hash',
  'passwordHash',
  'refresh_token_hash',
  'refreshTokenHash',
  'password',
]);

export function transformKeysToCamel(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map((item) => transformKeysToCamel(item));
  }
  if (typeof data === 'object' && data.constructor === Object) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_FIELDS.has(key)) {
        continue;
      }
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformKeysToCamel(value);
    }
    return result;
  }
  return data;
}

@Injectable()
export class SerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transformKeysToCamel(data)));
  }
}
