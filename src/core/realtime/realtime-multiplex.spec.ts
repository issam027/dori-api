import { firstValueFrom, of, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { RealtimeAuthorizationService } from './realtime-authorization.service';
import { QueueDisplaySubscriptionDto } from './queue-display-subscription.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('multiplexed authenticated display subscriptions', () => {
  const user = {
    accessTokenExpiresAt: Date.now() / 1000 + 60,
  } as AuthenticatedUser;
  it('authorizes every queue before opening any stream', async () => {
    const verifyDisplay = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('forbidden'));
    const streamDisplay = jest.fn();
    const controller = new RealtimeController(
      { streamDisplay } as unknown as RealtimeService,
      { verifyDisplay } as unknown as RealtimeAuthorizationService,
    );
    await expect(
      controller.displayMany({ queueIds: ['a', 'b'] }, user),
    ).rejects.toThrow('forbidden');
    expect(streamDisplay).not.toHaveBeenCalled();
  });
  it('labels heartbeats so every queue retains its own health state', async () => {
    const verifyDisplay = jest.fn().mockResolvedValue(undefined);
    const streamDisplay = jest
      .fn()
      .mockImplementation(async () =>
        of({ type: 'heartbeat', data: { timestamp: 'now' } }),
      );
    const controller = new RealtimeController(
      { streamDisplay } as unknown as RealtimeService,
      { verifyDisplay } as unknown as RealtimeAuthorizationService,
    );
    const stream = await controller.displayMany({ queueIds: ['a', 'b'] }, user);
    const values = await firstValueFrom(stream.pipe(toArray()));
    expect(values.map((event) => event.data)).toEqual([
      { timestamp: 'now', queueId: 'a' },
      { timestamp: 'now', queueId: 'b' },
    ]);
    for (const call of streamDisplay.mock.calls) {
      await call[2].authorize();
      expect(call[2].expiresAt).toBeInstanceOf(Date);
    }
    expect(verifyDisplay).toHaveBeenCalledTimes(4);
  });
  it('rejects malformed or oversized queue selections', async () => {
    expect(
      await validate(
        plainToInstance(QueueDisplaySubscriptionDto, { queueIds: 'invalid' }),
      ),
    ).not.toHaveLength(0);
    const ids = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(
      await validate(
        plainToInstance(QueueDisplaySubscriptionDto, {
          queueIds: ids.join(','),
        }),
      ),
    ).not.toHaveLength(0);
  });
});
