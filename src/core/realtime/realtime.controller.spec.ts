import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { ClockService } from '../clock/clock.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DoriException } from '../errors/dori.exception';

describe('Realtime authorization lifecycle', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const queueId = 'queue';
  const user: AuthenticatedUser = {
    userId: 'user',
    username: 'user',
    roles: ['operator'],
    permissions: [],
    userType: 'human',
    sessionId: 'session',
    accessTokenExpiresAt: now.getTime() / 1000 + 60,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());

  function setup() {
    const repository = {
      findTopicState: jest.fn().mockResolvedValue(null),
      findRegistrationByTrackingToken: jest.fn().mockResolvedValue({
        queue_id: queueId,
        is_active: true,
        registration_tracking_token_valid_until: new Date(
          now.getTime() + 60000,
        ),
      }),
    };
    const sessions = {
      findValidSessionId: jest.fn().mockResolvedValue('session'),
    };
    const scope = { checkQueueAccess: jest.fn().mockResolvedValue(undefined) };
    const clock = new ClockService();
    const service = new RealtimeService(clock, repository as never);
    const controller = new RealtimeController(
      service,
      repository as never,
      scope as never,
      clock,
      sessions as never,
    );
    return { controller, repository, sessions, scope };
  }

  it.each(['session', 'scope'])(
    'closes an open display stream after %s revocation',
    async (revocation) => {
      const { controller, sessions, scope } = setup();
      const stream = await controller.display(queueId, user);
      const complete = jest.fn();
      stream.subscribe({ complete });
      if (revocation === 'session')
        sessions.findValidSessionId.mockResolvedValue(null);
      else
        scope.checkQueueAccess.mockRejectedValue(
          new DoriException('QUEUE_NOT_FOUND'),
        );
      await jest.advanceTimersByTimeAsync(2000);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(scope.checkQueueAccess).toHaveBeenCalledWith(user, queueId, {
        fresh: true,
      });
    },
  );

  it('closes display exactly at JWT expiry', async () => {
    const { controller } = setup();
    const stream = await controller.display(queueId, {
      ...user,
      accessTokenExpiresAt: now.getTime() / 1000 + 1,
    });
    const complete = jest.fn();
    stream.subscribe({ complete });
    await jest.advanceTimersByTimeAsync(1000);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it.each(['removed', 'inactive', 'different-queue'])(
    'closes tracking when its registration becomes %s',
    async (change) => {
      const { controller, repository } = setup();
      const stream = await controller.tracking(queueId, 'token');
      const complete = jest.fn();
      stream.subscribe({ complete });
      if (change === 'removed')
        repository.findRegistrationByTrackingToken.mockResolvedValue(null);
      else
        repository.findRegistrationByTrackingToken.mockResolvedValue({
          queue_id: change === 'different-queue' ? 'other-queue' : queueId,
          is_active: change !== 'inactive',
          registration_tracking_token_valid_until: new Date(
            now.getTime() + 60000,
          ),
        });
      await jest.advanceTimersByTimeAsync(2000);
      expect(complete).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an expired tracking token before opening the stream', async () => {
    const { controller } = setup();
    jest.setSystemTime(new Date(now.getTime() + 60000));
    await expect(controller.tracking(queueId, 'token')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });
});
