import 'reflect-metadata';
import * as http from 'http';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { ClockService } from '../src/core/clock/clock.service';
import { REDIS_CLIENT } from '../src/core/redis/redis.module';
import {
  parseQueueRealtimeEvent,
  QUEUE_EVENTS_CHANNEL,
} from '../src/core/realtime/queue-realtime-event';
import { RealtimeRepository } from '../src/core/realtime/realtime.repository';
import { WsAuthService } from '../src/core/realtime/ws-auth.service';
import { ScopeService } from '../src/core/rbac/services/scope.service';
import { AuthenticatedUser } from '../src/core/auth/interfaces/jwt-payload.interface';

interface SocketData {
  user?: AuthenticatedUser;
  trackingToken?: string;
  trackingQueueId?: string;
}

interface ClientToServerEvents {
  subscribe: (
    data: { room?: string },
    acknowledge?: (response: Record<string, unknown>) => void,
  ) => void;
  ping_session: (
    data: { queueId?: string; sessionId?: string },
    acknowledge?: (response: Record<string, unknown>) => void,
  ) => void;
}

interface ServerToClientEvents {
  queue_display_changed: (payload: Record<string, unknown>) => void;
  queue_position_changed: (payload: Record<string, unknown>) => void;
}

type DoriSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const logger = new Logger('VercelSocketIo');
const UUID_PATTERN =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';
const allowedOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = http.createServer();
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
});

const dependenciesPromise = NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
}).then((app) => ({
  wsAuthService: app.get(WsAuthService, { strict: false }),
  realtimeRepository: app.get(RealtimeRepository, { strict: false }),
  scopeService: app.get(ScopeService, { strict: false }),
  clockService: app.get(ClockService, { strict: false }),
  redis: app.get<Redis | null>(REDIS_CLIENT, { strict: false }),
}));

async function waitUntilRedisReady(redis: Redis): Promise<void> {
  if (redis.status === 'ready') return;
  if (redis.status === 'wait') {
    await redis.connect();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      redis.off('ready', onReady);
      redis.off('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    redis.once('ready', onReady);
    redis.once('error', onError);
  });
}

io.use(async (socket: DoriSocket, next) => {
  try {
    const dependencies = await dependenciesPromise;
    const auth = socket.handshake.auth ?? {};
    const authorization = socket.handshake.headers.authorization;
    const token =
      auth.token ??
      (authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : undefined);
    const trackingToken =
      auth.registrationToken ??
      socket.handshake.headers['x-registration-token'];

    if (token) {
      socket.data.user = await dependencies.wsAuthService.authenticate(
        String(token),
      );
      next();
      return;
    }

    if (trackingToken) {
      const registration =
        await dependencies.realtimeRepository.findRegistrationByTrackingToken(
          String(trackingToken),
        );
      if (registration) {
        const validUntil = dependencies.clockService.parse(
          registration.registration_tracking_token_valid_until,
        );
        if (
          validUntil > dependencies.clockService.now() &&
          registration.is_active
        ) {
          socket.data.trackingToken = String(trackingToken);
          socket.data.trackingQueueId = String(registration.queue_id);
          next();
          return;
        }
      }
    }

    next(new Error('Unauthorized'));
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket: DoriSocket) => {
  socket.on(
    'subscribe',
    async (
      data: { room?: string },
      acknowledge?: (response: Record<string, unknown>) => void,
    ) => {
      const respond = (response: Record<string, unknown>) => {
        acknowledge?.(response);
      };
      const room = data?.room;
      if (!room) {
        respond({ error: 'Room required' });
        return;
      }

      const displayMatch = room.match(
        new RegExp(`^queue:(${UUID_PATTERN}):display$`),
      );
      const trackingMatch = room.match(
        new RegExp(`^queue:(${UUID_PATTERN}):tracking$`),
      );

      if (displayMatch) {
        if (!socket.data.user) {
          respond({ error: 'Authentication required' });
          return;
        }
        try {
          const { scopeService } = await dependenciesPromise;
          await scopeService.checkQueueAccess(
            socket.data.user,
            displayMatch[1],
          );
          await socket.join(room);
          respond({ subscribed: true, room });
        } catch {
          respond({ error: 'Queue out of scope' });
        }
        return;
      }

      if (trackingMatch) {
        if (
          !socket.data.trackingToken ||
          socket.data.trackingQueueId !== trackingMatch[1]
        ) {
          respond({ error: 'Access denied' });
          return;
        }
        await socket.join(room);
        respond({ subscribed: true, room });
        return;
      }

      respond({ error: 'Unknown room' });
    },
  );

  socket.on('ping_session', async (data, acknowledge) => {
    if (!socket.data.user || !data?.queueId || !data?.sessionId) {
      acknowledge?.({ acknowledged: false });
      return;
    }
    try {
      const { realtimeRepository, clockService } = await dependenciesPromise;
      const now = clockService.now();
      await realtimeRepository.touchQueueSession(
        data.sessionId,
        data.queueId,
        socket.data.user.userId,
        now,
      );
      acknowledge?.({ acknowledged: true, timestamp: now.toISOString() });
    } catch {
      acknowledge?.({ acknowledged: false });
    }
  });
});

void dependenciesPromise
  .then(async ({ redis }) => {
    if (!redis) throw new Error('Redis is required for realtime subscriptions');
    const subscriber = redis.duplicate();
    subscriber.on('error', (error: Error) => {
      logger.warn(`Redis subscriber error: ${error.message}`);
    });
    subscriber.on('message', (channel, rawEvent) => {
      if (channel !== QUEUE_EVENTS_CHANNEL) return;
      const realtimeEvent = parseQueueRealtimeEvent(rawEvent);
      if (!realtimeEvent) {
        logger.warn('Ignored invalid queue realtime event');
        return;
      }
      if (realtimeEvent.event === 'queue_display_changed') {
        io.local
          .to(realtimeEvent.room)
          .emit('queue_display_changed', realtimeEvent.payload);
      } else {
        io.local
          .to(realtimeEvent.room)
          .emit('queue_position_changed', realtimeEvent.payload);
      }
    });
    await waitUntilRedisReady(subscriber);
    await subscriber.subscribe(QUEUE_EVENTS_CHANNEL);
    logger.log(`Subscribed to Redis channel ${QUEUE_EVENTS_CHANNEL}`);
  })
  .catch((error: Error) => {
    logger.error(`Realtime initialization failed: ${error.message}`);
  });

export default server;
