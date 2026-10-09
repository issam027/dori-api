import { DataSource } from 'typeorm';
import { JwtSessionRepository } from './jwt-session.repository';

describe('JwtSessionRepository', () => {
  it('queries valid session using provided now timestamp without NOW() in SQL', async () => {
    const fixedNow = new Date('2026-10-06T15:30:00.000Z');
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ session_id: 'test-session-123' }]),
    } as unknown as DataSource;

    const repository = new JwtSessionRepository(dataSource);
    const result = await repository.findValidSessionId(
      'test-session-123',
      42,
      fixedNow,
    );

    expect(result).toBe('test-session-123');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('s.expires_at > $3'),
      ['test-session-123', 42, fixedNow],
    );
    const sqlQuery = (dataSource.query as jest.Mock).mock.calls[0][0] as string;
    expect(sqlQuery).not.toContain('NOW()');
  });

  it('returns null if no active session is returned', async () => {
    const fixedNow = new Date('2026-10-06T15:30:00.000Z');
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as DataSource;

    const repository = new JwtSessionRepository(dataSource);
    const result = await repository.findValidSessionId(
      'expired-session',
      42,
      fixedNow,
    );

    expect(result).toBeNull();
  });
});
