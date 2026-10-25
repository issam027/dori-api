import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { safeErrorName } from '../logging/safe-error';

export class ConfiguredIoAdapter extends IoAdapter {
  private readonly logger = new Logger(ConfiguredIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
    redisClient?: Redis | null,
  ) {
    super(app);
    if (
      redisClient &&
      (!redisClient.status ||
        redisClient.status === 'ready' ||
        redisClient.status === 'connecting')
    ) {
      try {
        const pubClient = redisClient;
        const subClient = pubClient.duplicate();
        subClient.on('error', (err: Error) => {
          this.logger.debug(
            `Socket.IO Redis subClient error type=${safeErrorName(err)}`,
          );
        });
        this.adapterConstructor = createAdapter(pubClient, subClient, {
          key: 'dori:socket.io',
        });
        this.logger.log('Socket.IO adapter connected to Redis pub/sub (dori:socket.io)');
      } catch (err) {
        this.logger.warn(
          `Failed to initialize Socket.IO Redis adapter: ${(err as Error).message}. Falling back to memory adapter.`,
        );
      }
    }
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
