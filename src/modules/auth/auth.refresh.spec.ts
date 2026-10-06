import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { ClockService } from '../../core/clock/clock.service';
import { ScopeService } from '../../core/rbac/services/scope.service';

describe('AuthService refresh rotation', () => {
  const now = new Date('2026-10-06T12:00:00.000Z');
  const expiresAt = new Date('2026-11-05T12:00:00.000Z');

  const createService = (status: 'rotated' | 'invalid' | 'reused') => {
    const repository = {
      rotateRefreshSession: jest.fn().mockResolvedValue(
        status === 'rotated'
          ? {
              status,
              sessionId: 'new-session',
              user: {
                user_id: 7,
                username: 'agent',
                password_hash: 'hash',
                user_type: 'human',
              },
            }
          : { status },
      ),
      getRolesAndPermissions: jest.fn().mockResolvedValue({
        roles: ['manager'],
        permissions: ['queue_view'],
      }),
    } as unknown as AuthRepository;
    const jwt = { sign: jest.fn().mockReturnValue('access-token') };
    const config = { get: jest.fn().mockReturnValue(30) };
    const clock = {
      now: jest.fn().mockReturnValue(now),
      addDays: jest.fn().mockReturnValue(expiresAt),
    };
    const service = new AuthService(
      repository,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      clock as unknown as ClockService,
      {} as ScopeService,
    );
    return { service, repository, jwt };
  };

  it('returns tokens only after the repository committed a rotation', async () => {
    const { service, repository, jwt } = createService('rotated');

    const result = await service.refresh('current-refresh', '127.0.0.1', 'ua');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(repository.rotateRefreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTokenHash: expect.not.stringContaining('current-refresh'),
        nextTokenHash: expect.any(String),
        now,
        expiresAt,
        ipAddress: '127.0.0.1',
        userAgent: 'ua',
      }),
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sid: 'new-session', sub: 7 }),
    );
  });

  it.each(['invalid', 'reused'] as const)(
    'rejects a %s refresh token without signing an access token',
    async (status) => {
      const { service, jwt } = createService(status);

      await expect(service.refresh('current-refresh')).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
      expect(jwt.sign).not.toHaveBeenCalled();
    },
  );
});
