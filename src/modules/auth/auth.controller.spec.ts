import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('AuthController environment cookies', () => {
  function setup(name: string | undefined) {
    const service = {
      refresh: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'rotated' }),
      logout: jest.fn().mockResolvedValue({}),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'jwt.refreshCookieName' ? name : undefined,
      ),
    };
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    return {
      service,
      response,
      controller: new AuthController(
        service as unknown as AuthService,
        config as unknown as ConfigService,
      ),
    };
  }
  it('prefers the cookie for this deployment without consuming another environment cookie', async () => {
    const { controller, service, response } = setup('refreshToken_intra');
    await controller.refresh(
      {},
      {
        cookies: {
          refreshToken_intra: 'intra',
          refreshToken_cloud: 'cloud',
          refreshToken: 'legacy',
        },
        headers: {},
        socket: {},
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(service.refresh).toHaveBeenCalledWith('intra', undefined, undefined);
    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken_intra',
      'rotated',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
  it('migrates a legacy cookie only after the server accepts it', async () => {
    const { controller, service, response } = setup('refreshToken_cloud');
    await controller.refresh(
      {},
      {
        cookies: { refreshToken: 'legacy' },
        headers: {},
        socket: {},
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(service.refresh).toHaveBeenCalledWith(
      'legacy',
      undefined,
      undefined,
    );
    expect(response.cookie.mock.calls[0][0]).toBe('refreshToken_cloud');
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken');
  });
  it('keeps the default cookie contract and clears only the current environment on logout', async () => {
    const { controller, response } = setup(undefined);
    await controller.refresh(
      {},
      {
        cookies: { refreshToken: 'legacy' },
        headers: {},
        socket: {},
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.cookie.mock.calls[0][0]).toBe('refreshToken');
    const scoped = setup('refreshToken_intra');
    await scoped.controller.logout(
      {} as AuthenticatedUser,
      {},
      scoped.response as unknown as Response,
    );
    expect(scoped.response.clearCookie).toHaveBeenCalledWith(
      'refreshToken_intra',
    );
  });
});
