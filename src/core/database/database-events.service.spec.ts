import { EventEmitter } from 'events';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DatabaseEventsService } from './database-events.service';

jest.mock('pg', () => ({ Client: jest.fn() }));

describe('database notification connection', () => {
  const clients: Array<EventEmitter & { query: jest.Mock; end: jest.Mock }> =
    [];
  beforeEach(() => {
    jest.useFakeTimers();
    clients.length = 0;
    jest.mocked(Client).mockImplementation(() => {
      const client = Object.assign(new EventEmitter(), {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
      });
      clients.push(client);
      return client as unknown as Client;
    });
  });
  afterEach(() => jest.useRealTimers());
  function service() {
    const values: Record<string, unknown> = {
      'database.listenUrl': 'postgresql://localhost/db',
      'database.realtimeSafetyMs': 300000,
    };
    return new DatabaseEventsService({
      get: (key: string) => values[key],
      getOrThrow: (key: string) => values[key],
    } as unknown as ConfigService);
  }
  it('opens one session, filters notifications, and performs no heartbeat SQL', async () => {
    const bus = service();
    await bus.onModuleInit();
    const next = jest.fn();
    const subscription = bus.changes(['tracking:abc']).subscribe(next);
    clients[0].emit('notification', {
      channel: 'dorify_realtime',
      payload: '{"key":"tracking:other"}',
    });
    clients[0].emit('notification', {
      channel: 'dorify_realtime',
      payload: '{"key":"tracking:abc"}',
    });
    expect(next).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(299999);
    expect(next).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(next).toHaveBeenLastCalledWith({ key: 'recovery' });
    expect(clients).toHaveLength(1);
    expect(clients[0].query).toHaveBeenCalledTimes(1);
    expect(clients[0].query).toHaveBeenCalledWith('LISTEN dorify_realtime');
    subscription.unsubscribe();
    await bus.onApplicationShutdown();
  });
  it('reconnects after disconnect and requests a catch-up after LISTEN is restored', async () => {
    const bus = service();
    await bus.onModuleInit();
    const next = jest.fn();
    bus.changes([]).subscribe(next);
    clients[0].emit('end');
    expect(bus.connected).toBe(false);
    await jest.advanceTimersByTimeAsync(1300);
    expect(clients).toHaveLength(2);
    expect(bus.connected).toBe(true);
    expect(next).toHaveBeenCalledWith({ key: 'recovery' });
    await bus.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(60000);
    expect(clients).toHaveLength(2);
  });
  it('invalidates the installation room exactly at command expiry and cancels completed-command timers', async () => {
    const bus = service();
    await bus.onModuleInit();
    const next = jest.fn();
    bus.changes(['edge-installations']).subscribe(next);
    const emit = (value: object) =>
      clients[0].emit('notification', {
        channel: 'dorify_realtime',
        payload: JSON.stringify(value),
      });
    emit({
      key: 'edge-installations',
      commandId: 'one',
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    });
    expect(next).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1050);
    expect(next).toHaveBeenCalledTimes(2);
    emit({
      key: 'edge-installations',
      commandId: 'two',
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    });
    emit({ key: 'edge-installations', commandId: 'two', expiresAt: null });
    await jest.advanceTimersByTimeAsync(1050);
    expect(next).toHaveBeenCalledTimes(4);
    expect(clients[0].query).toHaveBeenCalledTimes(1);
    await bus.onApplicationShutdown();
  });
});
