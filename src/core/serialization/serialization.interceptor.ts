import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SERIALIZATION_DTO_KEY } from '../swagger/api-dori-response.decorator';

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

type SerializationTarget = { dto: Type<unknown>; isArray: boolean };

function dtoProperties(dto: Type<unknown>): string[] {
  const properties = new Set<string>();
  let prototype = dto.prototype;
  while (prototype && prototype !== Object.prototype) {
    const declared = Reflect.getMetadata(
      'swagger/apiModelPropertiesArray',
      prototype,
    ) as string[] | undefined;
    declared?.forEach((property) => properties.add(property.replace(/^:/, '')));
    prototype = Object.getPrototypeOf(prototype);
  }
  return [...properties];
}

function nestedDto(
  dto: Type<unknown>,
  property: string,
): Type<unknown> | undefined {
  let prototype = dto.prototype;
  while (prototype && prototype !== Object.prototype) {
    const metadata = Reflect.getMetadata(
      'swagger/apiModelProperties',
      prototype,
      property,
    ) as
      | { type?: Type<unknown> | (() => Type<unknown> | [Type<unknown>]) }
      | undefined;
    if (metadata?.type) {
      let resolved: unknown = metadata.type;
      if (
        typeof resolved === 'function' &&
        ![String, Number, Boolean, Date].includes(resolved as never)
      ) {
        try {
          resolved = (resolved as () => unknown)();
        } catch {
          // A class constructor cannot be called without `new`; use it directly.
        }
      }
      if (Array.isArray(resolved)) resolved = resolved[0];
      if (
        typeof resolved === 'function' &&
        ![String, Number, Boolean, Date, Object, Array].includes(
          resolved as never,
        )
      ) {
        return resolved as Type<unknown>;
      }
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return undefined;
}

function projectToDto(data: unknown, dto: Type<unknown>): unknown {
  if (data == null) return data;
  if (Array.isArray(data)) return data.map((item) => projectToDto(item, dto));
  if (typeof data !== 'object') return data;

  const allowed = dtoProperties(dto);
  if (!allowed.length) return data;
  return Object.fromEntries(
    allowed
      .filter((property) =>
        Object.prototype.hasOwnProperty.call(data, property),
      )
      .map((property) => {
        const value = (data as Record<string, unknown>)[property];
        const childDto = nestedDto(dto, property);
        return [property, childDto ? projectToDto(value, childDto) : value];
      }),
  );
}

@Injectable()
export class SerializationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler?.();
    const target = handler
      ? this.reflector.get<SerializationTarget>(SERIALIZATION_DTO_KEY, handler)
      : undefined;
    return next.handle().pipe(
      map((data) => {
        const normalized = transformKeysToCamel(data);
        return target ? projectToDto(normalized, target.dto) : normalized;
      }),
    );
  }
}
