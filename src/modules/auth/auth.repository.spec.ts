import { DataSource } from 'typeorm';
import { AuthRepository } from './auth.repository';

describe('AuthRepository refresh rotation', () => {
  const now = new Date('2026-10-06T12:00:00.000Z');
  const expiresAt = new Date('2026-11-05T12:00:00.000Z');

  const createRepository = (results: unknown[][]) => {
    const manager = {
      query: jest.fn().mockImplementation(() => results.shift() ?? []),
    };
    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
    } as unknown as DataSource;
    return { repository: new AuthRepository(dataSource), dataSource, manager };
  };

  it('locks, consumes and replaces a refresh session in one transaction', async () => {
    const user = {
      user_id: 7,
      username: 'agent',
      password_hash: 'hash',
      user_type: 'human' as const,
    };
    const { repository, dataSource, manager } = createRepository([
      [
        {
          session_id: 'old-session',
          user_id: 7,
          expires_at: expiresAt,
          revoked_at: null,
        },
      ],
      [user],
      [{ session_id: 'old-session' }],
      [{ session_id: 'new-session' }],
    ]);

    await expect(
      repository.rotateRefreshSession({
        currentTokenHash: 'old-hash',
        nextTokenHash: 'new-hash',
        now,
        expiresAt,
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      }),
    ).resolves.toEqual({ status: 'rotated', user, sessionId: 'new-session' });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(manager.query.mock.calls[2][0]).toContain(
      'WHERE session_id = $2 AND revoked_at IS NULL',
    );
    expect(manager.query.mock.calls[3][0]).toContain(
      'INSERT INTO dori_user_session',
    );
  });

  it('treats a locked revoked token as reuse and revokes the active family', async () => {
    const { repository, manager } = createRepository([
      [
        {
          session_id: 'old-session',
          user_id: 7,
          expires_at: expiresAt,
          revoked_at: now,
        },
      ],
      [],
    ]);

    await expect(
      repository.rotateRefreshSession({
        currentTokenHash: 'old-hash',
        nextTokenHash: 'new-hash',
        now,
        expiresAt,
      }),
    ).resolves.toEqual({ status: 'reused' });

    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(manager.query.mock.calls[1][0]).toContain(
      "revoked_reason = 'rotation'",
    );
    expect(manager.query.mock.calls[1][1]).toEqual([now, 7]);
  });
});
