import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Token d'injection pour le client Redis partagé.
 * Usage : @Inject(REDIS_CLIENT) private readonly redis: Redis
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Module Redis global : expose un client ioredis unique partagé
 * entre tous les modules (ScopeService, ThrottlerStorage, etc.)
 * Le décorateur @Global() évite de l'importer manuellement dans chaque module.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        return new Redis({
          host: config.getOrThrow<string>('redis.host'),
          port: config.getOrThrow<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          // Reconnexion automatique avec back-off exponentiel
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          lazyConnect: false,
          enableReadyCheck: true,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
