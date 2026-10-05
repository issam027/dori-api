import { of, lastValueFrom } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import {
  SerializationInterceptor,
  transformKeysToCamel,
} from './serialization.interceptor';

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
});
