import { of, firstValueFrom } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  class TestController {}
  const testHandler = () => undefined;
  const context = {
    getHandler: () => testHandler,
    getClass: () => TestController,
  } as never;

  it('wraps a business object that merely contains a code property', async () => {
    const interceptor = new ResponseInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ code: 'PF01' }) }),
    );

    expect(result).toEqual({
      code: 'OK',
      translationKey: null,
      translationParams: {},
      data: { code: 'PF01' },
    });
  });

  it('preserves a complete standard response', async () => {
    const interceptor = new ResponseInterceptor();
    const envelope = {
      code: 'NO_CALLABLE_REGISTRATION',
      translationKey: 'queue.next.no_callable_registration',
      translationParams: {},
      data: null,
    };
    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of(envelope) }),
    );

    expect(result).toBe(envelope);
  });
});
