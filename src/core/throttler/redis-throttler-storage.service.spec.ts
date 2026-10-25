import { RedisThrottlerStorage } from './redis-throttler-storage.service';

describe('RedisThrottlerStorage', () => {
  let redisMock: {
    status: string;
    eval: jest.Mock;
  };

  beforeEach(() => {
    redisMock = {
      status: 'ready',
      eval: jest.fn(),
    };
  });

  it('increments using Redis Lua script when Redis is ready', async () => {
    redisMock.eval.mockResolvedValueOnce([1, 60000]);
    const storage = new RedisThrottlerStorage(redisMock as never);

    const record = await storage.increment('auth:ip:127.0.0.1', 60000);

    expect(record).toEqual({
      totalHits: 1,
      timeToExpire: 60,
    });
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('PEXPIRE'),
      1,
      'dori:throttle:auth:ip:127.0.0.1',
      60000,
    );
  });

  it('falls back to in-memory storage when Redis is not provided', async () => {
    const storage = new RedisThrottlerStorage(null);

    const rec1 = await storage.increment('test-key', 5000);
    expect(rec1.totalHits).toBe(1);
    expect(rec1.timeToExpire).toBeGreaterThan(0);

    const rec2 = await storage.increment('test-key', 5000);
    expect(rec2.totalHits).toBe(2);
  });

  it('falls back to in-memory storage when Redis eval throws error', async () => {
    redisMock.eval.mockRejectedValueOnce(new Error('Connection timeout'));
    const storage = new RedisThrottlerStorage(redisMock as never);

    const rec = await storage.increment('failing-key', 10000);
    expect(rec.totalHits).toBe(1);
    expect(rec.timeToExpire).toBe(10);
  });
});
