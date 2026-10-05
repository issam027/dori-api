import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { DoriException } from '../../errors/dori.exception';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('JwtStrategy', () => {
  const payload: JwtPayload = {
    sub: 1,
    sid: 'session-a',
    username: 'agent',
    roles: ['operator'],
    permissions: ['queue_view'],
    userType: 'human',
  };

  const createStrategy = (rows: unknown[]) => {
    const config = {
      getOrThrow: jest
        .fn()
        .mockReturnValue('a-secure-secret-with-at-least-32-characters'),
    } as unknown as ConfigService;
    const dataSource = {
      query: jest.fn().mockResolvedValue(rows),
    } as unknown as DataSource;
    return { strategy: new JwtStrategy(config, dataSource), dataSource };
  };

  it('rejects a token without sid even if another session could exist', async () => {
    const { strategy, dataSource } = createStrategy([{ session_id: 'other' }]);

    await expect(
      strategy.validate({
        ...payload,
        sid: undefined,
      } as unknown as JwtPayload),
    ).rejects.toThrow(new DoriException('UNAUTHENTICATED'));
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('accepts only the active session tied to the token user', async () => {
    const { strategy, dataSource } = createStrategy([
      { session_id: 'session-a' },
    ]);

    await expect(strategy.validate(payload)).resolves.toMatchObject({
      userId: 1,
      sessionId: 'session-a',
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('s.session_id = $1 AND s.user_id = $2'),
      ['session-a', 1],
    );
  });
});
