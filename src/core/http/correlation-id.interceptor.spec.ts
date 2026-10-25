import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';

describe('CorrelationIdInterceptor', () => {
  const request = { headers: {} as Record<string, string> };
  const next: CallHandler = { handle: () => of('response') };

  beforeEach(() => {
    request.headers = {};
  });

  it('sets the response header before a regular response starts', async () => {
    const response = { headersSent: false, setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    await firstValueFrom(
      new CorrelationIdInterceptor().intercept(context, next),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );
  });

  it('does not modify headers after an SSE response has started', async () => {
    const response = { headersSent: true, setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    await expect(
      firstValueFrom(new CorrelationIdInterceptor().intercept(context, next)),
    ).resolves.toBe('response');
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(request.headers['x-correlation-id']).toEqual(expect.any(String));
  });
});
