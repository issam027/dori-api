import { of, lastValueFrom } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import {
  SerializationInterceptor,
  transformKeysToCamel,
} from './serialization.interceptor';
import { ApiProperty } from '@nestjs/swagger';
import { SERIALIZATION_DTO_KEY } from '../swagger/api-dori-response.decorator';

class ProjectionDto {
  @ApiProperty()
  userId: number;
}

class ProjectionItemDto {
  @ApiProperty()
  queueId: number;
}

class ProjectionPageDto {
  @ApiProperty({ type: [ProjectionItemDto] })
  items: ProjectionItemDto[];

  @ApiProperty()
  total: number;
}

describe('SerializationInterceptor', () => {
  it('centralizes snake_case, nested values and Date serialization', () => {
    const createdAt = new Date('2026-09-29T08:00:00.000Z');

    expect(
      transformKeysToCamel({
        user_id: 2,
        created_at: createdAt,
        nested_value: [{ queue_id: 4 }],
        password_hash: 'must-not-leak',
      }),
    ).toEqual({
      userId: 2,
      createdAt: '2026-09-29T08:00:00.000Z',
      nestedValue: [{ queueId: 4 }],
    });
  });

  it('serializes the complete handler result through the interceptor', async () => {
    const interceptor = new SerializationInterceptor();
    const next: CallHandler = {
      handle: () => of({ items: [{ session_id: 101 }] }),
    };

    const result = await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, next),
    );

    expect(result).toEqual({ items: [{ sessionId: 101 }] });
  });

  it('removes fields not declared by the response DTO', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      SERIALIZATION_DTO_KEY,
      { dto: ProjectionDto, isArray: false },
      handler,
    );
    const context = {
      getHandler: () => handler,
    } as unknown as ExecutionContext;
    const result = await lastValueFrom(
      new SerializationInterceptor().intercept(context, {
        handle: () =>
          of({ user_id: 2, password_hash: 'secret', internal_flag: true }),
      }),
    );
    expect(result).toEqual({ userId: 2 });
  });

  it('projects nested DTO arrays recursively', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      SERIALIZATION_DTO_KEY,
      { dto: ProjectionPageDto, isArray: false },
      handler,
    );
    const context = {
      getHandler: () => handler,
    } as unknown as ExecutionContext;
    const result = await lastValueFrom(
      new SerializationInterceptor().intercept(context, {
        handle: () =>
          of({ items: [{ queue_id: 4, internal_flag: true }], total: 1 }),
      }),
    );
    expect(result).toEqual({ items: [{ queueId: 4 }], total: 1 });
  });
});
