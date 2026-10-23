import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { safeErrorName } from '../logging/safe-error';

/**
 * Token d'injection pour le client Redis partagé.
 * Usage : @Inject(REDIS_CLIENT) @Optional() private readonly redis?: Redis | null
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Module Redis global : expose un client ioredis unique partagé
 * entre tous les modules (ScopeService, MonitoringService, etc.)
 * Le décorateur @Global() évite de l'importer manuellement dans chaque module.
 *
 * Si Redis n'est pas configuré (REDIS_HOST absent ou désactivé),
 * le provider retourne null et les services basculent en fallback BDD / mémoire.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const isExport = process.env.SWAGGER_EXPORT === 'true';
        const enabled = config.get<boolean>('redis.enabled', true);
        const host = config.get<string | undefined>('redis.host');

        if (
          !enabled ||
          !host ||
          host === '' ||
          host === 'none' ||
          host === 'disabled'
        ) {
          logger.log(
            'Redis is disabled or not configured. Running with in-memory / DB fallback.',
          );
          return null;
        }

        const port = config.get<number>('redis.port') ?? 6379;
        const password = config.get<string>('redis.password') || undefined;

        const client = new Redis({
          host,
          port,
          password,
          // Pas d'accumulation en file hors-ligne : échoue immédiatement si Redis est inaccessible
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          // Reconnexion avec back-off si Redis redémarre
          retryStrategy: (times: number) => {
            if (isExport) return null;
            return Math.min(times * 500, 5000);
          },
          lazyConnect: isExport,
          enableReadyCheck: !isExport,
        });

        client.on('error', (err: Error) => {
          // Journalisation en debug pour éviter de polluer les logs si Redis n'est pas lancé en local
          logger.debug(`Redis connection error type=${safeErrorName(err)}`);
        });

        client.on('connect', () => {
          logger.log('Connected to Redis');
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
