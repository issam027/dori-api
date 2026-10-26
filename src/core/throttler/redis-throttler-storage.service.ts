import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';
import { safeErrorName } from '../logging/safe-error';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
}

const THROTTLE_KEY_PREFIX = 'dori:throttle:';
const MAX_MEMORY_ENTRIES = 10_000;

interface MemoryRecord {
  totalHits: number;
  expiresAt: number;
}

/**
 * Implémentation distribuée du stockage Throttler basée sur Redis.
 * - Utilise un script Lua atomique pour INCR + PEXPIRE à l'initialisation.
 * - Repli automatique en mémoire si Redis est indisponible ou non configuré.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memoryStorage = new Map<string, MemoryRecord>();
  private memoryOperations = 0;

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis | null,
  ) {}

  private isRedisReady(): boolean {
    return Boolean(
      this.redis && (!this.redis.status || this.redis.status === 'ready'),
    );
  }

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const prefixedKey = `${THROTTLE_KEY_PREFIX}${key}`;

    if (this.isRedisReady() && this.redis) {
      try {
        // Script Lua atomique : INCR et, s'il s'agit de la 1ère incrémentation, PEXPIRE en millisecondes
        const luaScript = `
          local current = redis.call('INCR', KEYS[1])
          if current == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
          end
          local ttlMs = redis.call('PTTL', KEYS[1])
          return { current, ttlMs }
        `;
        const result = (await this.redis.eval(
          luaScript,
          1,
          prefixedKey,
          ttl,
        )) as [number, number];

        const totalHits = Number(result[0]);
        const ttlMs = Math.max(0, Number(result[1]));

        return {
          totalHits,
          timeToExpire: Math.ceil(ttlMs / 1000),
        };
      } catch (error: unknown) {
        this.logger.debug(
          `Redis throttle unavailable type=${safeErrorName(error)}; falling back to process-local memory`,
        );
      }
    }

    return this.incrementMemory(prefixedKey, ttl);
  }

  private incrementMemory(key: string, ttl: number): ThrottlerStorageRecord {
    const now = Date.now();
    this.pruneMemory(now);
    const entry = this.memoryStorage.get(key);

    if (!entry || entry.expiresAt <= now) {
      this.memoryStorage.set(key, { totalHits: 1, expiresAt: now + ttl });
      return { totalHits: 1, timeToExpire: Math.ceil(ttl / 1000) };
    }

    entry.totalHits += 1;
    const timeToExpire = Math.max(0, Math.ceil((entry.expiresAt - now) / 1000));
    return {
      totalHits: entry.totalHits,
      timeToExpire,
    };
  }

  private pruneMemory(now: number): void {
    this.memoryOperations += 1;
    if (this.memoryOperations % 100 === 0) {
      for (const [key, entry] of this.memoryStorage) {
        if (entry.expiresAt <= now) this.memoryStorage.delete(key);
      }
    }
    while (this.memoryStorage.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memoryStorage.keys().next().value as
        string | undefined;
      if (!oldestKey) break;
      this.memoryStorage.delete(oldestKey);
    }
  }
}
