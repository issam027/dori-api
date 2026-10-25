import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway subscriptions', () => {
  const queueId = '00000000-0000-4000-8000-000000000001';
  const scopeService = {
    checkQueueAccess: jest.fn().mockResolvedValue(undefined),
  };
  const gateway = new RealtimeGateway(
    {} as never,
    {} as never,
    scopeService as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows an authenticated scoped user to subscribe to the UUID display room', async () => {
    const client = {
      user: { userId: 'user-id' },
      join: jest.fn(),
    };
    const room = `queue:${queueId}:display`;

    await expect(
      gateway.handleSubscribe(client as never, { room }),
    ).resolves.toEqual({ subscribed: true, room });
    expect(client.join).toHaveBeenCalledWith(room);
  });

  it('allows tracking only for the queue resolved from the tracking token', async () => {
    const client = {
      trackingToken: 'tracking-token',
      trackingQueueId: queueId,
      join: jest.fn(),
    };
    const room = `queue:${queueId}:tracking`;

    await expect(
      gateway.handleSubscribe(client as never, { room }),
    ).resolves.toEqual({ subscribed: true, room });
    expect(client.join).toHaveBeenCalledWith(room);
  });

  it('rejects every other room', async () => {
    const client = { join: jest.fn() };

    await expect(
      gateway.handleSubscribe(client as never, {
        room: `queue:${queueId}:ops`,
      }),
    ).resolves.toEqual({ error: 'Unknown room' });
    await expect(
      gateway.handleSubscribe(client as never, {
        room: 'system:translations',
      }),
    ).resolves.toEqual({ error: 'Unknown room' });
  });
});
